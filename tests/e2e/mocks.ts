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
export const setupTauriMock = (data: { initialState: MockState, persistenceKey?: string }) => {
    let state = data.initialState;
    const DISK_KEY = data.persistenceKey;

    if (DISK_KEY) {
        const stored = localStorage.getItem(DISK_KEY);
        if (stored) {
            console.log(`[TauriMock] Restoring state from ${DISK_KEY}`);
            state = JSON.parse(stored);
        }
    }

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
             case "load_elf_symbols":
                return state.elf_symbols || [];
            
            case "create_measurements_from_elf": {
                const { symbols } = args;
                const newMeas = symbols.map((s: any) => ({
                    name: s.name,
                    kind: "Measurement",
                    long_identifier: "",
                    datatype: "UBYTE",
                    ecu_address: typeof s.address === 'number' ? `0x${s.address.toString(16).toUpperCase()}` : s.address, // Fix address formatting if needed
                    lower_limit: 0,
                    upper_limit: 255,
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

            case "save_a2l_to_path":
                persist();
                return;
        }
        
        console.warn(`[TauriMock] Unhandled command: ${cmd}`);
        return null;
      }
    };
};
