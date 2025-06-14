let wasm;

// Initialize the WebAssembly module
async function init() {
    try {
        // Show loading indicator
        document.getElementById('loading').style.display = 'block';
        
        // Try to import the generated WASM module
        // This assumes wasm-pack has been run with --target web
        try {
            wasm = await import('./pkg/hello_wasm.js');
            await wasm.default();
            console.log('WebAssembly module loaded successfully!');
        } catch (importError) {
            console.warn('Could not load from ./pkg/, trying alternative paths...');
            // Fallback: try to load from different possible locations
            throw new Error('WASM module not found. Please build with: wasm-pack build --target web --out-dir pkg');
        }
        
        // Hide loading indicator
        document.getElementById('loading').style.display = 'none';
        
        // Setup event listeners
        setupEventListeners();
        
        // Show initial greeting
        displayMessage('Ready! WebAssembly module loaded successfully.', 'hello-output', 'success');
        
    } catch (error) {
        console.error('Failed to initialize WebAssembly:', error);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').classList.remove('hidden');
        
        // Fallback: create mock functions for demonstration
        console.log('Creating fallback demo functions...');
        setupFallbackDemo();
    }
}

// Setup event listeners for all demo buttons
function setupEventListeners() {
    // Hello World button
    document.getElementById('hello-btn').addEventListener('click', () => {
        try {
            const message = wasm.hello_world();
            displayMessage(message, 'hello-output', 'success');
        } catch (error) {
            displayMessage(`Error: ${error.message}`, 'hello-output', 'error');
        }
    });

    // Greet button
    document.getElementById('greet-btn').addEventListener('click', () => {
        try {
            const name = document.getElementById('name-input').value || 'World';
            const message = wasm.greet(name);
            displayMessage(message, 'greet-output', 'success');
        } catch (error) {
            displayMessage(`Error: ${error.message}`, 'greet-output', 'error');
        }
    });

    // Add button
    document.getElementById('add-btn').addEventListener('click', () => {
        try {
            const num1 = parseInt(document.getElementById('num1').value) || 0;
            const num2 = parseInt(document.getElementById('num2').value) || 0;
            const result = wasm.add(num1, num2);
            displayMessage(`${num1} + ${num2} = ${result}`, 'calc-output', 'success');
        } catch (error) {
            displayMessage(`Error: ${error.message}`, 'calc-output', 'error');
        }
    });

    // Timestamp button
    document.getElementById('timestamp-btn').addEventListener('click', () => {
        try {
            const timestamp = wasm.get_timestamp();
            const date = new Date(timestamp);
            displayMessage(`Timestamp: ${timestamp}<br>Date: ${date.toLocaleString()}`, 'timestamp-output', 'success');
        } catch (error) {
            displayMessage(`Error: ${error.message}`, 'timestamp-output', 'error');
        }
    });

    // Yahoo homepage button
    document.getElementById('load-yahoo-btn').addEventListener('click', async () => {
        try {
            displayMessage('Loading Yahoo homepage...', 'yahoo-output', 'info');
            const response = await fetch('/api/proxy/yahoo');
            const data = await response.json();
            
            if (data.success) {
                displayMessage('Yahoo homepage loaded successfully', 'yahoo-output', 'success');
                document.getElementById('yahoo-content').innerHTML = data.content;
            } else {
                displayMessage(`Error: ${data.error}`, 'yahoo-output', 'error');
                document.getElementById('yahoo-content').innerHTML = data.content || '';
            }
        } catch (error) {
            displayMessage(`Failed to load Yahoo homepage: ${error.message}`, 'yahoo-output', 'error');
            document.getElementById('yahoo-content').innerHTML = '';
        }
    });

    // Yahoo news button
    document.getElementById('load-news-btn').addEventListener('click', async () => {
        try {
            displayMessage('Loading Yahoo news...', 'yahoo-output', 'info');
            const response = await fetch('/api/proxy/yahoo/news');
            const data = await response.json();
            
            if (data.success && data.articles.length > 0) {
                displayMessage(`Loaded ${data.articles.length} news articles`, 'yahoo-output', 'success');
                
                const newsHtml = `
                    <div class="news-container">
                        <h3>Yahoo News Headlines</h3>
                        <ul class="news-list">
                            ${data.articles.map(article => 
                                `<li><a href="${article.url}" target="_blank">${article.title}</a></li>`
                            ).join('')}
                        </ul>
                    </div>
                `;
                document.getElementById('yahoo-content').innerHTML = newsHtml;
            } else {
                displayMessage('No news articles found', 'yahoo-output', 'warning');
                document.getElementById('yahoo-content').innerHTML = '';
            }
        } catch (error) {
            displayMessage(`Failed to load Yahoo news: ${error.message}`, 'yahoo-output', 'error');
            document.getElementById('yahoo-content').innerHTML = '';
        }
    });

    // Open Yahoo in new tab button
    document.getElementById('open-yahoo-tab-btn').addEventListener('click', () => {
        try {
            const yahooWindow = window.open('https://www.yahoo.co.jp/', '_blank', 'noopener,noreferrer');
            if (yahooWindow) {
                displayMessage('Yahoo homepage opened in new tab', 'yahoo-output', 'success');
            } else {
                displayMessage('Popup blocked - please allow popups for this site', 'yahoo-output', 'warning');
            }
        } catch (error) {
            displayMessage(`Failed to open Yahoo: ${error.message}`, 'yahoo-output', 'error');
        }
    });

    // Open Yahoo News in new tab button
    document.getElementById('open-yahoo-news-tab-btn').addEventListener('click', () => {
        try {
            const yahooNewsWindow = window.open('https://news.yahoo.com', '_blank', 'noopener,noreferrer');
            if (yahooNewsWindow) {
                displayMessage('Yahoo News opened in new tab', 'yahoo-output', 'success');
            } else {
                displayMessage('Popup blocked - please allow popups for this site', 'yahoo-output', 'warning');
            }
        } catch (error) {
            displayMessage(`Failed to open Yahoo News: ${error.message}`, 'yahoo-output', 'error');
        }
    });
}

// Setup fallback demo functions when WASM is not available
function setupFallbackDemo() {
    // Create mock wasm object with fallback functions
    wasm = {
        hello_world: () => "Hello, World from JavaScript fallback! (WASM not loaded)",
        greet: (name) => `Hello, ${name}! This is a JavaScript fallback message.`,
        add: (a, b) => a + b,
        get_timestamp: () => Date.now()
    };
    
    setupEventListeners();
    displayMessage('Running in fallback mode - WASM module not available', 'hello-output', 'warning');
}

// Utility function to display messages
function displayMessage(message, elementId, type = 'info') {
    const element = document.getElementById(elementId);
    element.innerHTML = message;
    element.className = `output ${type}`;
    
    // Auto-clear after 10 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            if (element.innerHTML === message) {
                element.innerHTML = '';
                element.className = 'output';
            }
        }, 10000);
    }
}

// Handle errors globally
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Initialize the application
init();
