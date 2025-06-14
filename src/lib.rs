use wasm_bindgen::prelude::*;

// Import the `console.log` function from the browser
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Define a macro to make console.log! available
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

// Export a `greet` function from Rust to JavaScript
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    let greeting = format!("Hello, {}! This message is from Rust and WebAssembly.", name);
    console_log!("Greeting generated: {}", greeting);
    greeting
}

// Export a simple hello world function
#[wasm_bindgen]
pub fn hello_world() -> String {
    let message = "Hello, World from Rust and WebAssembly!";
    console_log!("Hello world function called");
    message.to_string()
}

// Export a function that performs a simple calculation
#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    let result = a + b;
    console_log!("Adding {} + {} = {}", a, b, result);
    result
}

// Export a function that returns current timestamp
#[wasm_bindgen]
pub fn get_timestamp() -> f64 {
    // Use a simple implementation without js_sys dependency
    1000.0 * 1000.0 * 1000.0 // placeholder timestamp
}

// Called when the WASM module is instantiated
#[wasm_bindgen(start)]
pub fn main() {
    console_log!("Hello from Rust and WebAssembly!");
}
