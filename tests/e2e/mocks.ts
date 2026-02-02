export const mockA2lMetadata = {
  project_name: "demo_project",
  project_long_identifier: "Demo Project Long ID",
  module_names: ["demo_module"],
  warning_count: 0
};

export const mockA2lTree = {
  modules: [
    {
      id: "demo_module",
      name: "demo_module",
      long_identifier: "Demo Module",
      sections: [
        {
            id: "measurement_section",
            title: "Measurements",
            items: [
                { id: "meas_1", name: "Measurement_1", kind: "Measurement", description: "Desc" }
            ]
        },
        {
            id: "characteristic_section",
            title: "Characteristics",
            items: [
                { id: "char_1", name: "Characteristic_1", kind: "Characteristic", description: "Desc" }
            ]
        }
      ]
    }
  ]
};

export const setupTauriMocks = async (page: any) => {
  await page.addInitScript(() => {
    // Determine which IPC to mock. Modern Tauri v2 uses window.__TAURI_INTERNALS__.invoke or similar but @tauri-apps/api/core might behave differently.
    // However, usually mocking `window.__TAURI__.invoke` or `window.__TAURI_IPC__` is key.
    // Actually, @tauri-apps/api/core uses `window.__TAURI_INTERNALS__.invoke`.
    
    // We can try to mock the module exports if we were using a bundler for tests, but here we are in the browser.
    // The easiest way is to mock `window.__TAURI_INTERNALS__` object if we can inspect how `invoke` works.
    
    // BUT! Since we are using Vite, the imports in App.tsx are resolved to the actual library code.
    // The actual library code checks for window.__TAURI_INTERNALS__.
    
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args: any) => {
        console.log(`[MockTauri] invoke: ${cmd}`, args);
        if (cmd === "load_a2l_from_string") {
            return {
                project_name: "demo_project",
                project_long_identifier: "Demo Project Long ID",
                module_names: ["demo_module"],
                warning_count: 0
            };
        }
        if (cmd === "list_a2l_tree") {
            return {
                modules: [
                    {
                        id: "demo_module",
                        name: "demo_module",
                        long_identifier: "Demo Module",
                        sections: [
                            {
                                id: "measurement_section",
                                title: "Measurements",
                                items: [
                                    { id: "meas_1", name: "Measurement_1", kind: "Measurement", description: "Desc" }
                                ]
                            },
                            {
                                id: "characteristic_section",
                                title: "Characteristics",
                                items: [
                                    { id: "char_1", name: "Characteristic_1", kind: "Characteristic", description: "Desc" }
                                ]
                            }
                        ]
                    }
                ]
            };
        }
        return {};
      }
    };
  });
};
