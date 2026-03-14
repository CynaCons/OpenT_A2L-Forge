//! ELF/DWARF parsing and type inference for symbol extraction.
//!
//! This module handles loading ELF binaries, extracting symbol tables (.symtab / .dynsym),
//! parsing DWARF debug information for type names, struct members, arrays, and enums,
//! and inferring A2L data types from symbol metadata.

use std::collections::{HashMap, HashSet};
use std::fs;

use goblin::elf::Elf;

use crate::types::{DwarfMemberInfo, DwarfSymbolInfo, ElfSymbol};

#[derive(Clone, Debug)]
struct RawDwarfMemberInfo {
    name: String,
    offset: u64,
    size: u64,
    type_name: String,
    type_offset: Option<gimli::DebugInfoOffset>,
    array_dims: Vec<u64>,
    element_type_name: Option<String>,
    element_size: u64,
    enum_variants: Vec<(String, i64)>,
}

// ─── Public core functions ──────────────────────────────────────────────────

/// Load ELF symbols from a file path.
pub fn core_load_elf_symbols(path: &str) -> Result<Vec<ElfSymbol>, String> {
    let buffer = fs::read(path).map_err(|e| e.to_string())?;
    core_load_elf_symbols_from_buffer(&buffer)
}

/// Load ELF symbols from an in-memory buffer.
pub fn core_load_elf_symbols_from_buffer(buffer: &[u8]) -> Result<Vec<ElfSymbol>, String> {
    let elf = Elf::parse(buffer).map_err(|e| format!("ELF parse error: {}", e))?;
    let dwarf_info = parse_dwarf_symbols(buffer);

    // Collect symbols from BOTH .symtab and .dynsym for maximum coverage
    // Each entry is (sym, use_dynstrtab)
    let mut all_syms: Vec<(goblin::elf::Sym, bool)> = Vec::new();
    for sym in elf.syms.iter() {
        all_syms.push((sym, false));
    }
    // Also add .dynsym symbols (deduplicated by name later)
    for sym in elf.dynsyms.iter() {
        all_syms.push((sym, true));
    }

    if all_syms.is_empty() {
        return Ok(Vec::new());
    }

    let mut symbols = Vec::new();
    let mut seen_names = HashSet::new();
    for (sym, is_dyn) in &all_syms {
        let name_opt = if *is_dyn {
            elf.dynstrtab.get_at(sym.st_name)
        } else {
            elf.strtab.get_at(sym.st_name)
        };
        if let Some(name) = name_opt {
            if !name.is_empty() && seen_names.insert(name.to_string()) {
                let type_str = goblin::elf::sym::type_to_str(sym.st_type()).to_string();
                let bind = goblin::elf::sym::bind_to_str(sym.st_bind()).to_string();

                let section = if sym.st_shndx < elf.section_headers.len() {
                    let sh = &elf.section_headers[sym.st_shndx];
                    elf.shdr_strtab.get_at(sh.sh_name).unwrap_or("").to_string()
                } else {
                    "".to_string()
                };

                let addr_warning = validate_address(sym.st_value);

                let var_enum_vals = dwarf_info
                    .get(name)
                    .map(|info| info.enum_variants.clone())
                    .unwrap_or_default();

                // Check if DWARF info reveals this is an array variable
                let dwarf_array = dwarf_info.get(name).and_then(|info| {
                    if !info.array_dims.is_empty() {
                        Some((
                            info.array_dims.clone(),
                            info.element_type_name.clone(),
                            info.element_size,
                        ))
                    } else {
                        None
                    }
                });

                let (suggested_type, min_limit, max_limit, var_array_dims, dwarf_type) =
                    if let Some((arr_dims, elem_type, elem_size)) = dwarf_array {
                        // Array variable: infer type from element type/size
                        let etype = elem_type.as_deref().unwrap_or("");
                        let (a2l_type, mn, mx) = infer_a2l_type_from_member(etype, elem_size);
                        let dims_str = format_dims(&arr_dims);
                        let display =
                            format!("{}{}", elem_type.as_deref().unwrap_or("unknown"), dims_str);
                        (a2l_type, mn, mx, arr_dims, Some(display))
                    } else if let Some(dinfo) = dwarf_info.get(name) {
                        // DWARF type name is known but no explicit array info;
                        // use the type name for better inference, and check if
                        // the total size suggests an array
                        let elem_size = infer_element_size(&dinfo.type_name);
                        let (a2l_type, mn, mx) =
                            infer_a2l_type_from_member(&dinfo.type_name, elem_size);
                        let arr_dims = if elem_size > 0
                            && sym.st_size > elem_size
                            && sym.st_size % elem_size == 0
                        {
                            vec![sym.st_size / elem_size]
                        } else {
                            Vec::new()
                        };
                        let display = if !arr_dims.is_empty() {
                            format!("{}{}", dinfo.type_name, format_dims(&arr_dims))
                        } else {
                            dinfo.type_name.clone()
                        };
                        (a2l_type, mn, mx, arr_dims, Some(display))
                    } else {
                        let (a2l_type, mn, mx) = infer_a2l_type(name, sym.st_size);
                        (a2l_type, mn, mx, Vec::new(), None)
                    };

                symbols.push(ElfSymbol {
                    name: name.to_string(),
                    address: sym.st_value,
                    size: sym.st_size,
                    bind: bind.clone(),
                    type_str: type_str.clone(),
                    section: section.clone(),
                    suggested_a2l_type: suggested_type,
                    suggested_limits: (min_limit, max_limit),
                    address_warning: addr_warning,
                    dwarf_type,
                    is_struct_member: false,
                    parent_struct: None,
                    array_dims: var_array_dims,
                    enum_values: var_enum_vals,
                });

                if let Some(info) = dwarf_info.get(name) {
                    if !info.members.is_empty() {
                        for member in &info.members {
                            let full_name = format!("{}.{}", name, member.name);
                            let member_addr = sym.st_value + member.offset;

                            // For arrays: use element type/size for A2L type inference
                            let (infer_type, infer_size) = if !member.array_dims.is_empty() {
                                let etype = member
                                    .element_type_name
                                    .as_deref()
                                    .unwrap_or(&member.type_name);
                                (etype, member.element_size)
                            } else {
                                (member.type_name.as_str(), member.size)
                            };
                            let (member_a2l_type, member_min, member_max) =
                                infer_a2l_type_from_member(infer_type, infer_size);
                            let member_addr_warning = validate_address(member_addr);

                            // Display type: for arrays/matrices, show "element_type[N][M]..."
                            let display_type = if !member.array_dims.is_empty() {
                                let elem = member.element_type_name.as_deref().unwrap_or("unknown");
                                format!("{}{}", elem, format_dims(&member.array_dims))
                            } else {
                                member.type_name.clone()
                            };

                            symbols.push(ElfSymbol {
                                name: full_name,
                                address: member_addr,
                                size: member.size,
                                bind: bind.clone(),
                                type_str: type_str.clone(),
                                section: section.clone(),
                                suggested_a2l_type: member_a2l_type,
                                suggested_limits: (member_min, member_max),
                                address_warning: member_addr_warning,
                                dwarf_type: Some(display_type),
                                is_struct_member: true,
                                parent_struct: Some(name.to_string()),
                                array_dims: member.array_dims.clone(),
                                enum_values: member.enum_variants.clone(),
                            });
                        }
                    }
                }
            }
        }
    }
    symbols.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(symbols)
}

// ─── Type inference functions ───────────────────────────────────────────────

/// Format array dimensions as "[N][M]..." for display.
pub(crate) fn format_dims(dims: &[u64]) -> String {
    dims.iter().map(|d| format!("[{}]", d)).collect::<String>()
}

/// Type inference based on symbol size and name heuristics.
pub(crate) fn infer_a2l_type(symbol_name: &str, symbol_size: u64) -> (String, f64, f64) {
    let name_lower = symbol_name.to_lowercase();

    match symbol_size {
        1 => {
            if name_lower.contains("signed")
                || name_lower.contains("int8")
                || name_lower.contains("sbyte")
            {
                ("SBYTE".to_string(), -128.0, 127.0)
            } else {
                ("UBYTE".to_string(), 0.0, 255.0)
            }
        }
        2 => {
            if name_lower.contains("signed")
                || name_lower.contains("int16")
                || name_lower.contains("sword")
            {
                ("SWORD".to_string(), -32768.0, 32767.0)
            } else {
                ("UWORD".to_string(), 0.0, 65535.0)
            }
        }
        4 => {
            if name_lower.contains("float")
                || name_lower.contains("flt")
                || name_lower.contains("f32")
            {
                ("FLOAT32_IEEE".to_string(), -3.4e38, 3.4e38)
            } else if name_lower.contains("signed")
                || name_lower.contains("int32")
                || name_lower.contains("slong")
                || name_lower.contains("i32")
            {
                ("SLONG".to_string(), -2147483648.0, 2147483647.0)
            } else {
                ("ULONG".to_string(), 0.0, 4294967295.0)
            }
        }
        8 => {
            if name_lower.contains("double")
                || name_lower.contains("dbl")
                || name_lower.contains("f64")
            {
                ("FLOAT64_IEEE".to_string(), -1.7e308, 1.7e308)
            } else if name_lower.contains("signed")
                || name_lower.contains("int64")
                || name_lower.contains("i64")
            {
                (
                    "A_INT64".to_string(),
                    -9223372036854775808.0,
                    9223372036854775807.0,
                )
            } else {
                ("A_UINT64".to_string(), 0.0, 18446744073709551615.0)
            }
        }
        _ => ("UBYTE".to_string(), 0.0, 255.0),
    }
}

/// Type inference for struct members using DWARF type name + byte size.
pub(crate) fn infer_a2l_type_from_member(dwarf_type: &str, size: u64) -> (String, f64, f64) {
    let t = dwarf_type.to_lowercase();

    // Float types
    if t == "float" || t.contains("float32") || (t.contains("float") && size == 4) {
        return ("FLOAT32_IEEE".to_string(), -3.4e38, 3.4e38);
    }
    if t == "double" || t.contains("float64") || (t.contains("double") && size == 8) {
        return ("FLOAT64_IEEE".to_string(), -1.7e308, 1.7e308);
    }

    // Signed integer types (no leading 'u' or 'unsigned' prefix)
    let is_signed = !t.starts_with('u') && !t.contains("unsigned") && !t.contains("uint");
    if is_signed
        && (t == "int"
            || t == "short"
            || t == "long"
            || t.contains("char")
            || t.starts_with("int")
            || t.contains("int8")
            || t.contains("int16")
            || t.contains("int32")
            || t.contains("int64"))
    {
        return match size {
            1 => ("SBYTE".to_string(), -128.0, 127.0),
            2 => ("SWORD".to_string(), -32768.0, 32767.0),
            4 => ("SLONG".to_string(), -2147483648.0, 2147483647.0),
            8 => (
                "A_INT64".to_string(),
                -9223372036854775808.0,
                9223372036854775807.0,
            ),
            _ => infer_a2l_type("", size),
        };
    }

    // Fall back to size-based inference (treats as unsigned)
    infer_a2l_type("", size)
}

/// Infer element byte size from a DWARF type name.
pub(crate) fn infer_element_size(dwarf_type: &str) -> u64 {
    let t = dwarf_type.to_lowercase();
    if t == "float" || t.contains("float32") || t == "f32" {
        4
    } else if t == "double" || t.contains("float64") || t == "f64" {
        8
    } else if t.contains("int8")
        || t.contains("uint8")
        || t == "char"
        || t == "unsigned char"
        || t == "_bool"
        || t == "bool"
    {
        1
    } else if t.contains("int16") || t.contains("uint16") || t == "short" || t == "unsigned short" {
        2
    } else if t.contains("int32")
        || t.contains("uint32")
        || t == "int"
        || t == "unsigned int"
        || t == "long"
        || t == "unsigned long"
    {
        4
    } else if t.contains("int64")
        || t.contains("uint64")
        || t == "long long"
        || t == "unsigned long long"
    {
        8
    } else {
        0 // unknown — don't infer array
    }
}

/// Validate address range (u64 to u32 conversion).
pub(crate) fn validate_address(address: u64) -> Option<String> {
    if address > 0xFFFFFFFF {
        Some(format!(
            "Address 0x{:X} exceeds 32-bit range, will be truncated to 0x{:X}",
            address, address as u32
        ))
    } else {
        None
    }
}

// ─── DWARF parsing ──────────────────────────────────────────────────────────

/// Parse DWARF debug info from an ELF buffer to extract type information.
/// Returns a map of symbol name -> DwarfSymbolInfo.
pub fn parse_dwarf_symbols(buffer: &[u8]) -> HashMap<String, DwarfSymbolInfo> {
    let mut result = HashMap::new();

    let elf = match goblin::elf::Elf::parse(buffer) {
        Ok(elf) => elf,
        Err(_) => return result,
    };

    let section_data = |name: &str| -> &[u8] {
        for sh in &elf.section_headers {
            if let Some(section_name) = elf.shdr_strtab.get_at(sh.sh_name) {
                if section_name == name {
                    let start = sh.sh_offset as usize;
                    let end = start + sh.sh_size as usize;
                    if end <= buffer.len() {
                        return &buffer[start..end];
                    }
                }
            }
        }
        &[]
    };

    // Detect endianness from ELF header
    let is_big_endian = buffer.get(5) == Some(&2);

    let load_section =
        |id: gimli::SectionId| -> Result<gimli::EndianSlice<'_, gimli::RunTimeEndian>, gimli::Error> {
            let data = section_data(id.name());
            let endian = if is_big_endian {
                gimli::RunTimeEndian::Big
            } else {
                gimli::RunTimeEndian::Little
            };
            Ok(gimli::EndianSlice::new(data, endian))
        };

    let dwarf_sections = match gimli::DwarfSections::load(load_section) {
        Ok(sections) => sections,
        Err(_) => return result,
    };
    let dwarf = dwarf_sections.borrow(|section| section.clone());

    // Build a type offset -> type name map
    let mut type_map: HashMap<gimli::DebugInfoOffset, String> = HashMap::new();
    let mut type_size_map: HashMap<gimli::DebugInfoOffset, u64> = HashMap::new();
    let mut type_indirection: HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset> =
        HashMap::new();
    let mut raw_struct_members: HashMap<gimli::DebugInfoOffset, Vec<RawDwarfMemberInfo>> =
        HashMap::new();
    let mut array_info: HashMap<
        gimli::DebugInfoOffset,
        (Option<gimli::DebugInfoOffset>, Vec<u64>),
    > = HashMap::new();
    let mut enum_values: HashMap<gimli::DebugInfoOffset, Vec<(String, i64)>> = HashMap::new();
    let mut current_enum_offset: Option<gimli::DebugInfoOffset> = None;

    // First pass: collect type names, sizes, and typedef/qualifier chains
    let mut units = dwarf.units();
    while let Ok(Some(header)) = units.next() {
        let unit = match dwarf.unit(header) {
            Ok(u) => u,
            Err(_) => continue,
        };

        let mut entries = unit.entries();
        let mut current_array_offset: Option<gimli::DebugInfoOffset> = None;
        while let Ok(Some((_, entry))) = entries.next_dfs() {
            let offset = entry
                .offset()
                .to_debug_info_offset(&unit.header)
                .unwrap_or(gimli::DebugInfoOffset(0));

            match entry.tag() {
                gimli::DW_TAG_base_type => {
                    if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                        type_map.insert(offset, name);
                    }
                    if let Some(size) = get_byte_size(entry) {
                        type_size_map.insert(offset, size);
                    }
                }
                gimli::DW_TAG_typedef => {
                    if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                        type_map.insert(offset, name);
                    }
                    if let Some(underlying) = resolve_type_to_offset(&unit, entry) {
                        type_indirection.insert(offset, underlying);
                    }
                }
                gimli::DW_TAG_structure_type => {
                    if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                        type_map.insert(offset, format!("struct {}", name));
                    }
                    if let Some(size) = get_byte_size(entry) {
                        type_size_map.insert(offset, size);
                    }
                }
                gimli::DW_TAG_enumeration_type => {
                    if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                        type_map.insert(offset, name);
                    }
                    if let Some(size) = get_byte_size(entry) {
                        type_size_map.insert(offset, size);
                    }
                    current_enum_offset = Some(offset);
                    enum_values.insert(offset, Vec::new());
                }
                gimli::DW_TAG_enumerator => {
                    if let Some(enum_off) = current_enum_offset {
                        if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                            let val = get_attr_sdata(entry, gimli::DW_AT_const_value).unwrap_or(0);
                            if let Some(vals) = enum_values.get_mut(&enum_off) {
                                vals.push((name, val));
                            }
                        }
                    }
                }
                gimli::DW_TAG_union_type => {
                    if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                        type_map.insert(offset, format!("union {}", name));
                    }
                    if let Some(size) = get_byte_size(entry) {
                        type_size_map.insert(offset, size);
                    }
                }
                gimli::DW_TAG_pointer_type => {
                    type_map.insert(offset, "pointer".to_string());
                    type_size_map.insert(offset, unit.encoding().address_size as u64);
                }
                gimli::DW_TAG_array_type => {
                    type_map.insert(offset, "array".to_string());
                    if let Some(size) = get_byte_size(entry) {
                        type_size_map.insert(offset, size);
                    }
                    let elem_type_off = resolve_type_to_offset(&unit, entry);
                    array_info.insert(offset, (elem_type_off, Vec::new()));
                    current_array_offset = Some(offset);
                }
                gimli::DW_TAG_subrange_type => {
                    if let Some(arr_off) = current_array_offset {
                        let count = get_attr_udata(entry, gimli::DW_AT_count).or_else(|| {
                            get_attr_udata(entry, gimli::DW_AT_upper_bound)
                                .and_then(|ub| ub.checked_add(1))
                        });
                        if let Some(count) = count {
                            if let Some(info) = array_info.get_mut(&arr_off) {
                                info.1.push(count);
                            }
                        }
                    }
                }
                gimli::DW_TAG_const_type
                | gimli::DW_TAG_volatile_type
                | gimli::DW_TAG_restrict_type => {
                    if let Some(underlying) = resolve_type_to_offset(&unit, entry) {
                        type_indirection.insert(offset, underlying);
                    }
                }
                _ => {
                    current_array_offset = None;
                    current_enum_offset = None;
                }
            }
        }
    }

    // Second pass: resolve struct members and variable types
    let mut units2 = dwarf.units();
    while let Ok(Some(header)) = units2.next() {
        let unit = match dwarf.unit(header) {
            Ok(u) => u,
            Err(_) => continue,
        };

        let mut entries = unit.entries();
        let mut current_struct_offset: Option<gimli::DebugInfoOffset> = None;
        let mut depth: isize = 0;
        let mut struct_depth: isize = 0;

        while let Ok(Some((delta, entry))) = entries.next_dfs() {
            depth += delta;

            match entry.tag() {
                gimli::DW_TAG_structure_type => {
                    let offset = entry
                        .offset()
                        .to_debug_info_offset(&unit.header)
                        .unwrap_or(gimli::DebugInfoOffset(0));
                    current_struct_offset = Some(offset);
                    struct_depth = depth;
                    if !raw_struct_members.contains_key(&offset) {
                        raw_struct_members.insert(offset, Vec::new());
                    }
                }
                gimli::DW_TAG_member
                    if current_struct_offset.is_some() && depth == struct_depth + 1 =>
                {
                    if let Some(struct_off) = current_struct_offset {
                        if let Some(member_name) = get_die_name(&dwarf, &unit, entry) {
                            let member_offset = get_member_location(entry);
                            let member_type_off = resolve_type_to_offset(&unit, entry);
                            let member_type = member_type_off
                                .and_then(|off| {
                                    resolve_type_name_through_chain(
                                        off,
                                        &type_map,
                                        &type_indirection,
                                    )
                                })
                                .unwrap_or_else(|| "unknown".to_string());
                            let member_size = member_type_off
                                .and_then(|off| {
                                    resolve_size_through_chain(
                                        off,
                                        &type_size_map,
                                        &type_indirection,
                                    )
                                })
                                .unwrap_or(0);

                            // Check if this member is an array type
                            let resolved_type_off = member_type_off.and_then(|off| {
                                resolve_array_through_chain(off, &type_indirection, &array_info)
                            });

                            let (arr_dims, elem_type_name, elem_size) =
                                if let Some(arr_off) = resolved_type_off {
                                    if let Some((elem_off, dims)) = array_info.get(&arr_off) {
                                        let elem_name = elem_off.and_then(|eoff| {
                                            let mut cur = eoff;
                                            for _ in 0..16 {
                                                if let Some(name) = type_map.get(&cur) {
                                                    return Some(name.clone());
                                                }
                                                match type_indirection.get(&cur) {
                                                    Some(&next) => cur = next,
                                                    None => return None,
                                                }
                                            }
                                            None
                                        });
                                        let esize = elem_off
                                            .and_then(|eoff| {
                                                resolve_size_through_chain(
                                                    eoff,
                                                    &type_size_map,
                                                    &type_indirection,
                                                )
                                            })
                                            .unwrap_or(0);
                                        (dims.clone(), elem_name, esize)
                                    } else {
                                        (Vec::new(), None, 0)
                                    }
                                } else {
                                    (Vec::new(), None, 0)
                                };

                            // Check if the member type resolves to an enum
                            let member_enum_vals = if let Some(arr_off) = resolved_type_off {
                                array_info
                                    .get(&arr_off)
                                    .and_then(|(elem_off, _)| *elem_off)
                                    .map(|elem_off| {
                                        resolve_enum_through_chain(
                                            elem_off,
                                            &type_indirection,
                                            &enum_values,
                                        )
                                    })
                                    .unwrap_or_default()
                            } else if let Some(type_off) = member_type_off {
                                resolve_enum_through_chain(
                                    type_off,
                                    &type_indirection,
                                    &enum_values,
                                )
                            } else {
                                Vec::new()
                            };

                            raw_struct_members.entry(struct_off).or_default().push(
                                RawDwarfMemberInfo {
                                    name: member_name,
                                    offset: member_offset,
                                    size: member_size,
                                    type_name: member_type,
                                    type_offset: member_type_off,
                                    array_dims: arr_dims,
                                    element_type_name: elem_type_name,
                                    element_size: elem_size,
                                    enum_variants: member_enum_vals,
                                },
                            );
                        }
                    }
                }
                gimli::DW_TAG_variable => {
                    if let Some(var_name) = get_die_name(&dwarf, &unit, entry) {
                        if let Some(direct_off) = resolve_type_to_offset(&unit, entry) {
                            let struct_off = resolve_struct_through_chain(
                                direct_off,
                                &type_indirection,
                                &raw_struct_members,
                            );
                            let type_name = resolve_type_name_through_chain(
                                direct_off,
                                &type_map,
                                &type_indirection,
                            )
                            .unwrap_or_else(|| "unknown".to_string());

                            // Resolve enum variants for this variable
                            let var_enum_vals = resolve_enum_through_chain(
                                direct_off,
                                &type_indirection,
                                &enum_values,
                            );

                            // Resolve array info by chasing through typedef/qualifier chain
                            let resolved_arr_off = {
                                let mut current = direct_off;
                                let mut found = None;
                                for _ in 0..16 {
                                    if array_info.contains_key(&current) {
                                        found = Some(current);
                                        break;
                                    }
                                    match type_indirection.get(&current) {
                                        Some(&next) => current = next,
                                        None => break,
                                    }
                                }
                                found
                            };
                            let (var_arr_dims, var_elem_type, var_elem_size) =
                                if let Some(arr_off) = resolved_arr_off {
                                    if let Some((elem_off, dims)) = array_info.get(&arr_off) {
                                        let elem_name = elem_off.and_then(|eoff| {
                                            resolve_type_name_through_chain(
                                                eoff,
                                                &type_map,
                                                &type_indirection,
                                            )
                                        });
                                        let esize = elem_off
                                            .and_then(|eoff| {
                                                resolve_size_through_chain(
                                                    eoff,
                                                    &type_size_map,
                                                    &type_indirection,
                                                )
                                            })
                                            .unwrap_or(0);
                                        (dims.clone(), elem_name, esize)
                                    } else {
                                        (Vec::new(), None, 0)
                                    }
                                } else {
                                    (Vec::new(), None, 0)
                                };

                            if let Some(soff) = struct_off {
                                if raw_struct_members.contains_key(&soff) {
                                    let base_type = resolve_type_name_through_chain(
                                        soff,
                                        &type_map,
                                        &type_indirection,
                                    )
                                    .or_else(|| {
                                        resolve_type_name_through_chain(
                                            direct_off,
                                            &type_map,
                                            &type_indirection,
                                        )
                                    })
                                    .unwrap_or_default();
                                    let mut members = Vec::new();
                                    let mut visited_structs = HashSet::new();
                                    flatten_struct_members(
                                        soff,
                                        "",
                                        0,
                                        &raw_struct_members,
                                        &type_indirection,
                                        &array_info,
                                        &mut visited_structs,
                                        &mut members,
                                    );
                                    result.insert(
                                        var_name.clone(),
                                        DwarfSymbolInfo {
                                            type_name: base_type,
                                            members,
                                            enum_variants: var_enum_vals.clone(),
                                            array_dims: var_arr_dims.clone(),
                                            element_type_name: var_elem_type.clone(),
                                            element_size: var_elem_size,
                                        },
                                    );
                                }
                            }

                            result.entry(var_name).or_insert(DwarfSymbolInfo {
                                type_name,
                                members: Vec::new(),
                                enum_variants: var_enum_vals,
                                array_dims: var_arr_dims,
                                element_type_name: var_elem_type,
                                element_size: var_elem_size,
                            });
                        } else {
                            result.entry(var_name).or_insert(DwarfSymbolInfo {
                                type_name: "unknown".to_string(),
                                members: Vec::new(),
                                enum_variants: Vec::new(),
                                array_dims: Vec::new(),
                                element_type_name: None,
                                element_size: 0,
                            });
                        }
                    }
                }
                _ => {
                    if depth <= struct_depth && current_struct_offset.is_some() {
                        current_struct_offset = None;
                    }
                }
            }
        }
    }

    result
}

// ─── DWARF helper functions ─────────────────────────────────────────────────

fn flatten_struct_members(
    struct_offset: gimli::DebugInfoOffset,
    prefix: &str,
    base_offset: u64,
    raw_struct_members: &HashMap<gimli::DebugInfoOffset, Vec<RawDwarfMemberInfo>>,
    type_indirection: &HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset>,
    array_info: &HashMap<gimli::DebugInfoOffset, (Option<gimli::DebugInfoOffset>, Vec<u64>)>,
    visited_structs: &mut HashSet<gimli::DebugInfoOffset>,
    out: &mut Vec<DwarfMemberInfo>,
) {
    if !visited_structs.insert(struct_offset) {
        return;
    }

    if let Some(members) = raw_struct_members.get(&struct_offset) {
        for member in members {
            let full_name = if prefix.is_empty() {
                member.name.clone()
            } else {
                format!("{prefix}.{}", member.name)
            };
            let total_offset = base_offset + member.offset;

            let nested_struct = member.type_offset.and_then(|type_off| {
                resolve_struct_through_chain(type_off, type_indirection, raw_struct_members)
            });
            let array_of_struct = member.type_offset.and_then(|type_off| {
                resolve_array_element_struct_through_chain(
                    type_off,
                    type_indirection,
                    array_info,
                    raw_struct_members,
                )
            });

            if member.array_dims.is_empty() {
                if let Some(nested_struct) = nested_struct {
                    flatten_struct_members(
                        nested_struct,
                        &full_name,
                        total_offset,
                        raw_struct_members,
                        type_indirection,
                        array_info,
                        visited_structs,
                        out,
                    );
                    continue;
                }
            } else if array_of_struct.is_some() {
                // Arrays of structs need layout semantics the current flat importer does not model.
                continue;
            }

            out.push(DwarfMemberInfo {
                name: full_name,
                offset: total_offset,
                size: member.size,
                type_name: member.type_name.clone(),
                array_dims: member.array_dims.clone(),
                element_type_name: member.element_type_name.clone(),
                element_size: member.element_size,
                enum_variants: member.enum_variants.clone(),
            });
        }
    }

    visited_structs.remove(&struct_offset);
}

/// Chase through typedef/const/volatile/restrict indirection until we find a struct type.
fn resolve_struct_through_chain<T>(
    start: gimli::DebugInfoOffset,
    type_indirection: &HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset>,
    struct_members: &HashMap<gimli::DebugInfoOffset, Vec<T>>,
) -> Option<gimli::DebugInfoOffset> {
    let mut current = start;
    for _ in 0..16 {
        if struct_members.contains_key(&current) {
            return Some(current);
        }
        match type_indirection.get(&current) {
            Some(&next) => current = next,
            None => return None,
        }
    }
    None
}

fn resolve_array_through_chain(
    start: gimli::DebugInfoOffset,
    type_indirection: &HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset>,
    array_info: &HashMap<gimli::DebugInfoOffset, (Option<gimli::DebugInfoOffset>, Vec<u64>)>,
) -> Option<gimli::DebugInfoOffset> {
    let mut current = start;
    for _ in 0..16 {
        if array_info.contains_key(&current) {
            return Some(current);
        }
        match type_indirection.get(&current) {
            Some(&next) => current = next,
            None => return None,
        }
    }
    None
}

fn resolve_array_element_struct_through_chain<T>(
    start: gimli::DebugInfoOffset,
    type_indirection: &HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset>,
    array_info: &HashMap<gimli::DebugInfoOffset, (Option<gimli::DebugInfoOffset>, Vec<u64>)>,
    struct_members: &HashMap<gimli::DebugInfoOffset, Vec<T>>,
) -> Option<gimli::DebugInfoOffset> {
    let array_offset = resolve_array_through_chain(start, type_indirection, array_info)?;
    let element_offset = array_info.get(&array_offset)?.0?;
    resolve_struct_through_chain(element_offset, type_indirection, struct_members)
}

/// Chase through typedef chain to find enum values if the type resolves to an enum.
fn resolve_enum_through_chain(
    start: gimli::DebugInfoOffset,
    type_indirection: &HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset>,
    enum_values: &HashMap<gimli::DebugInfoOffset, Vec<(String, i64)>>,
) -> Vec<(String, i64)> {
    let mut current = start;
    for _ in 0..16 {
        if let Some(vals) = enum_values.get(&current) {
            if !vals.is_empty() {
                return vals.clone();
            }
        }
        match type_indirection.get(&current) {
            Some(&next) => current = next,
            None => return Vec::new(),
        }
    }
    Vec::new()
}

/// Resolve type name through typedef/qualifier chain.
fn resolve_type_name_through_chain(
    start: gimli::DebugInfoOffset,
    type_map: &HashMap<gimli::DebugInfoOffset, String>,
    type_indirection: &HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset>,
) -> Option<String> {
    let mut current = start;
    for _ in 0..16 {
        if let Some(name) = type_map.get(&current) {
            return Some(name.clone());
        }
        match type_indirection.get(&current) {
            Some(&next) => current = next,
            None => return None,
        }
    }
    None
}

/// Resolve byte size through typedef/qualifier chain.
fn resolve_size_through_chain(
    start: gimli::DebugInfoOffset,
    type_size_map: &HashMap<gimli::DebugInfoOffset, u64>,
    type_indirection: &HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset>,
) -> Option<u64> {
    let mut current = start;
    for _ in 0..16 {
        if let Some(&size) = type_size_map.get(&current) {
            return Some(size);
        }
        match type_indirection.get(&current) {
            Some(&next) => current = next,
            None => return None,
        }
    }
    None
}

fn get_die_name(
    dwarf: &gimli::Dwarf<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
    unit: &gimli::Unit<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
) -> Option<String> {
    entry
        .attr_value(gimli::DW_AT_name)
        .ok()
        .flatten()
        .and_then(|val| {
            dwarf
                .attr_string(unit, val)
                .ok()
                .map(|s| s.to_string_lossy().into_owned())
        })
}

fn resolve_type_to_offset(
    unit: &gimli::Unit<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
) -> Option<gimli::DebugInfoOffset> {
    let val = entry.attr_value(gimli::DW_AT_type).ok().flatten()?;
    match val {
        gimli::AttributeValue::UnitRef(offset) => offset.to_debug_info_offset(&unit.header),
        gimli::AttributeValue::DebugInfoRef(offset) => Some(offset),
        _ => None,
    }
}

fn get_member_location(
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
) -> u64 {
    entry
        .attr_value(gimli::DW_AT_data_member_location)
        .ok()
        .flatten()
        .and_then(|val| match val {
            gimli::AttributeValue::Udata(v) => Some(v),
            gimli::AttributeValue::Sdata(v) => Some(v as u64),
            _ => None,
        })
        .unwrap_or(0)
}

fn get_byte_size(
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
) -> Option<u64> {
    entry
        .attr_value(gimli::DW_AT_byte_size)
        .ok()
        .flatten()
        .and_then(|val| match val {
            gimli::AttributeValue::Udata(v) => Some(v),
            gimli::AttributeValue::Sdata(v) => Some(v as u64),
            _ => None,
        })
}

fn get_attr_udata(
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
    attr: gimli::DwAt,
) -> Option<u64> {
    entry
        .attr_value(attr)
        .ok()
        .flatten()
        .and_then(|val| match val {
            gimli::AttributeValue::Udata(v) => Some(v),
            gimli::AttributeValue::Sdata(v) => Some(v as u64),
            gimli::AttributeValue::Data1(v) => Some(v as u64),
            gimli::AttributeValue::Data2(v) => Some(v as u64),
            gimli::AttributeValue::Data4(v) => Some(v as u64),
            gimli::AttributeValue::Data8(v) => Some(v),
            _ => None,
        })
}

fn get_attr_sdata(
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
    attr: gimli::DwAt,
) -> Option<i64> {
    entry
        .attr_value(attr)
        .ok()
        .flatten()
        .and_then(|val| match val {
            gimli::AttributeValue::Sdata(v) => Some(v),
            gimli::AttributeValue::Udata(v) => Some(v as i64),
            gimli::AttributeValue::Data1(v) => Some(v as i64),
            gimli::AttributeValue::Data2(v) => Some(v as i64),
            gimli::AttributeValue::Data4(v) => Some(v as i64),
            gimli::AttributeValue::Data8(v) => Some(v as i64),
            _ => None,
        })
}
