// Types
export type MockEntity = {
  name: string;
  kind: string;
  description?: string;
  [key: string]: any;
};

export type MockState = {
  metadata: {
    project_name: string;
    project_long_identifier: string;
    module_names: string[];
    warning_count: number;
  };
  measurements?: MockEntity[];
  characteristics?: MockEntity[];
  axis_pts?: MockEntity[];
  elf_symbols?: any[];
};

// This function runs IN THE BROWSER.
// It cannot close over variables from the test scope.
// It receives `data` as its argument.
export const setupTauriMock = (data: { initialState: MockState, persistenceKey?: string, elfFilePath?: string }) => {
    let state = data.initialState;
    const DISK_KEY = data.persistenceKey;
    const ELF_FILE_PATH = data.elfFilePath || "C:\\test\\sample.elf";

    if (DISK_KEY) {
        const stored = localStorage.getItem(DISK_KEY);
        if (stored) {
            console.log(`[TauriMock] Restoring state from ${DISK_KEY}`);
            state = JSON.parse(stored);
        }
    }

    // Mock dialog plugin
    (window as any).__TAURI_INVOKE__ = async (cmd: string, args: any) => {
        if (cmd === "plugin:dialog|open") {
            // Return the mocked ELF file path when dialog is opened
            return ELF_FILE_PATH;
        }
        throw new Error(`Unknown Tauri plugin command: ${cmd}`);
    };

    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args: any) => {
        // Reduced latency
        // await new Promise(r => setTimeout(r, 5));
        console.log(`[TauriMock] ${cmd}`, args);

        const persist = () => {
            if (DISK_KEY) {
                localStorage.setItem(DISK_KEY, JSON.stringify(state));
            }
        };

        switch (cmd) {
            case "load_a2l_from_string":
            case "load_a2l_from_path":
                // If loading from disk, we might want to reload state? 
                // For simplified mock, we assume 'load' just returns current metadata
                return state.metadata;

            case "list_a2l_tree":
                return {
                    modules: [{
                        id: state.metadata.module_names[0] || "mod1",
                        name: state.metadata.module_names[0] || "mod1",
                        long_identifier: state.metadata.project_long_identifier,
                        sections: [
                            {
                                id: "measurement_section",
                                title: "Measurements",
                                items: (state.measurements || []).map((m: any) => ({
                                    id: m.name,
                                    name: m.name,
                                    kind: "Measurement",
                                    description: m.long_identifier,
                                    details: [
                                        { label: "Limits", value: `${m.lower_limit} .. ${m.upper_limit}` },
                                        { label: "Datatype", value: m.datatype }
                                    ]
                                }))
                            },
                             {
                                id: "characteristic_section",
                                title: "Characteristics",
                                items: (state.characteristics || []).map((c: any) => ({
                                    id: c.name,
                                    name: c.name,
                                    kind: "Characteristic",
                                    description: c.long_identifier,
                                    details: [
                                        { label: "Address", value: c.address },
                                        { label: "Type", value: c.characteristic_type }
                                    ]
                                }))
                            },
                            {
                                id: "axis_pts_section",
                                title: "Axis Points",
                                items: (state.axis_pts || []).map((a: any) => ({
                                    id: a.name,
                                    name: a.name,
                                    kind: "AxisPts",
                                    description: a.long_identifier,
                                    details: [
                                        { label: "Input quantity", value: a.input_quantity },
                                        { label: "Max axis points", value: `${a.max_axis_points}` }
                                    ]
                                }))
                            }
                        ]
                    }]
                };

            // Entity Getters
            case "get_measurement":
                return (state.measurements || []).find((m: any) => m.name === args.name);
            case "get_characteristic":
                return (state.characteristics || []).find((c: any) => c.name === args.name);
            case "get_axis_pts":
                return (state.axis_pts || []).find((a: any) => a.name === args.name);

            // Entity Updates
            case "update_measurement": {
                if (!state.measurements) state.measurements = [];
                const idx = state.measurements.findIndex((m: any) => m.name === args.name);
                if (idx !== -1) {
                    state.measurements[idx] = { ...state.measurements[idx], ...args.data };
                    persist();
                }
                return;
            }
            case "update_characteristic": {
                if (!state.characteristics) state.characteristics = [];
                const idx = state.characteristics.findIndex((c: any) => c.name === args.name);
                if (idx !== -1) {
                    state.characteristics[idx] = { ...state.characteristics[idx], ...args.data };
                    persist();
                }
                return;
            }
            case "update_axis_pts": {
                if (!state.axis_pts) state.axis_pts = [];
                const idx = state.axis_pts.findIndex((a: any) => a.name === args.name);
                if (idx !== -1) {
                    state.axis_pts[idx] = { ...state.axis_pts[idx], ...args.data };
                    persist();
                }
                return;
            }

            // ELF
             case "load_elf_symbols": {
                // Enhance symbols with suggested types
                const symbols = (state.elf_symbols || []).map((s: any) => {
                    let suggested_a2l_type = "UBYTE";
                    let suggested_limits: [number, number] = [0, 255];

                    if (s.size === 2) {
                        suggested_a2l_type = "UWORD";
                        suggested_limits = [0, 65535];
                    } else if (s.size === 4) {
                        suggested_a2l_type = "ULONG";
                        suggested_limits = [0, 4294967295];
                    } else if (s.size === 8) {
                        suggested_a2l_type = "A_UINT64";
                        suggested_limits = [0, 18446744073709551615];
                    }

                    return {
                        ...s,
                        suggested_a2l_type,
                        suggested_limits,
                        address_warning: s.address > 0xFFFFFFFF ? "Address exceeds 32-bit range" : null
                    };
                });
                return symbols;
             }

            case "create_measurements_from_elf": {
                const { symbols } = args;
                const newMeas = symbols.map((s: any) => ({
                    name: s.name,
                    kind: "Measurement",
                    long_identifier: "",
                    datatype: s.suggested_a2l_type || "UBYTE",
                    ecu_address: typeof s.address === 'number' ? `0x${s.address.toString(16).toUpperCase()}` : s.address,
                    lower_limit: s.suggested_limits ? s.suggested_limits[0] : 0,
                    upper_limit: s.suggested_limits ? s.suggested_limits[1] : 255,
                    conversion: "NO_COMPU_METHOD",
                    resolution: 1,
                    accuracy: 0
                }));
                if (!state.measurements) state.measurements = [];
                state.measurements.push(...newMeas);
                persist();
                return {
                    metadata: state.metadata,
                    entities: []
                };
            }

            case "create_measurements_with_mapping": {
                const { symbols } = args;
                const newMeas = symbols.map((s: any) => ({
                    name: s.name,
                    kind: "Measurement",
                    long_identifier: "",
                    datatype: s.a2l_type,
                    ecu_address: typeof s.address === 'number' ? `0x${s.address.toString(16).toUpperCase()}` : s.address,
                    lower_limit: s.lower_limit,
                    upper_limit: s.upper_limit,
                    conversion: s.conversion || "NO_COMPU_METHOD",
                    resolution: s.resolution || 1,
                    accuracy: s.accuracy || 0
                }));
                if (!state.measurements) state.measurements = [];
                state.measurements.push(...newMeas);
                persist();
                return {
                    metadata: state.metadata,
                    entities: []
                };
            }

            case "check_symbol_conflicts": {
                const { symbols } = args;
                const conflicts: any[] = [];
                const non_conflicts: string[] = [];

                symbols.forEach((sym: any) => {
                    const existing = (state.measurements || []).find((m: any) => m.name === sym.name);
                    if (existing) {
                        conflicts.push({
                            symbol_name: sym.name,
                            existing_address: existing.ecu_address,
                            existing_type: existing.datatype,
                            new_address: `0x${sym.address.toString(16).toUpperCase()}`,
                            new_type: sym.a2l_type
                        });
                    } else {
                        non_conflicts.push(sym.name);
                    }
                });

                return { conflicts, non_conflicts };
            }

            case "save_a2l_to_path":
                persist();
                return;
        }
        
        console.warn(`[TauriMock] Unhandled command: ${cmd}`);
        return null;
      }
    };
};
