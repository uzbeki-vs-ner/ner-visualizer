// API Configuration - Using relative URLs for NGINX proxy
const PREDICT_ENDPOINT = '/api/v1/predict';
const HEALTH_ENDPOINT = '/healthz';

// For debugging
console.log('Using NGINX proxy with relative URLs');
console.log(`Predict endpoint: ${PREDICT_ENDPOINT}`);
console.log(`Health endpoint: ${HEALTH_ENDPOINT}`);

// Entity type configurations
const ENTITY_TYPES = {
    ORG: {
        className: 'entity-org',
        badgeClass: 'org',
        label: 'Organization',
        color: '#FFE082'
    },
    NAME: {
        className: 'entity-name',
        badgeClass: 'name',
        label: 'Person Name',
        color: '#90CAF9'
    },
    GEO: {
        className: 'entity-geo',
        badgeClass: 'geo',
        label: 'Geographic Location',
        color: '#A5D6A7'
    }
};

// DOM Elements
const inputText = document.getElementById('input-text');
const analyzeBtn = document.getElementById('analyze-btn');
const healthcheckBtn = document.getElementById('healthcheck-btn');
const outputText = document.getElementById('output-text');
const entityTableBody = document.getElementById('entity-table-body');
const entityList = document.getElementById('entity-list');
const legend = document.getElementById('legend');
const errorMessage = document.getElementById('error-message');
const healthStatus = document.getElementById('health-status');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');

// Event Listeners
analyzeBtn.addEventListener('click', analyzeText);
healthcheckBtn.addEventListener('click', performHealthcheck);

// Allow Enter key to trigger analysis (Ctrl+Enter or Cmd+Enter)
inputText.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        analyzeText();
    }
});

// Main analysis function
async function analyzeText() {
    const text = inputText.value.trim();
    
    if (!text) {
        showError('Please enter some text to analyze.');
        return;
    }
    
    // Disable button and show loading state
    setLoadingState(analyzeBtn, true, 'Analyzing...');
    hideError();
    
    try {
        // Prepare request payload following the API contract
        const requestData = [{
            hash: generateHash(),
            text: text
        }];
        
        console.log('Request payload:', requestData);
        console.log('Sending request to:', PREDICT_ENDPOINT);
        
        // Call API through NGINX proxy with correct headers
        const response = await fetch(PREDICT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('Response status:', response.status);
        console.log('Response content-type:', response.headers.get('content-type'));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`API returned status ${response.status}: ${errorText}`);
        }
        
        // Verify content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Expected application/json, got ${contentType}`);
        }
        
        const result = await response.json();
        console.log('Response data:', result);
        
        // Validate response structure according to contract
        if (!result || typeof result !== 'object' || !Array.isArray(result.data)) {
            throw new Error('Invalid response format: expected object with data[]');
        }
        
        // Find our result (should be the only one)
        const ourResult = result.data.find(item => item.hash === requestData[0].hash);
        
        if (!ourResult) {
            throw new Error('Response does not contain our hash');
        }
        
        if (!Array.isArray(ourResult.entities)) {
            throw new Error('Invalid response: entities must be an array');
        }
        
        // Validate each entity
        const validEntities = ourResult.entities.filter(entity => {
            return (
                entity &&
                typeof entity === 'object' &&
                ['ORG', 'NAME', 'GEO'].includes(entity.label) &&
                Number.isInteger(entity.start) &&
                Number.isInteger(entity.end) &&
                entity.start >= 0 &&
                entity.start < entity.end &&
                entity.end <= text.length
            );
        });
        
        console.log('Valid entities:', validEntities);
        
        // Process and display results
        displayResults(text, validEntities);
        
    } catch (error) {
        console.error('Analysis error:', error);
        showError(`Error during analysis: ${error.message}`);
        outputText.innerHTML = '<span class="placeholder">Analysis failed. Please try again.</span>';
        entityList.classList.add('hidden');
        legend.classList.add('hidden');
    } finally {
        setLoadingState(analyzeBtn, false, 'Search for entities');
    }
}

// Display NER results
function displayResults(originalText, entities) {
    if (!entities || entities.length === 0) {
        outputText.textContent = originalText;
        entityTableBody.innerHTML = '<tr><td colspan="4">No entities detected</td></tr>';
        entityList.classList.remove('hidden');
        legend.classList.add('hidden');
        return;
    }
    
    // Sort entities by start position
    const sortedEntities = [...entities].sort((a, b) => a.start - b.start);
    
    // Build highlighted HTML
    let highlightedText = '';
    let lastIndex = 0;
    
    sortedEntities.forEach((entity, index) => {
        // Add text before entity
        highlightedText += escapeHtml(originalText.substring(lastIndex, entity.start));
        
        // Add entity with highlighting
        const entityText = escapeHtml(originalText.substring(entity.start, entity.end));
        const entityConfig = ENTITY_TYPES[entity.label] || {
            className: 'entity-unknown',
            badgeClass: 'unknown',
            label: entity.label
        };
        
        highlightedText += `<span class="${entityConfig.className}" title="${entityConfig.label} - [${entity.start}, ${entity.end})" data-entity-index="${index}">${entityText}</span>`;
        
        lastIndex = entity.end;
    });
    
    // Add remaining text
    highlightedText += escapeHtml(originalText.substring(lastIndex));
    
    // Update output
    outputText.innerHTML = highlightedText;
    
    // Add click handlers to entity spans
    outputText.querySelectorAll('span[data-entity-index]').forEach(span => {
        span.addEventListener('click', () => {
            const index = parseInt(span.dataset.entityIndex);
            const entity = sortedEntities[index];
            const entityText = originalText.substring(entity.start, entity.end);
            const entityLabel = ENTITY_TYPES[entity.label]?.label || entity.label;
            alert(`Entity: "${entityText}"\nType: ${entity.label} (${entityLabel})\nPosition: [${entity.start}, ${entity.end})`);
        });
    });
    
    // Populate entity table
    populateEntityTable(sortedEntities, originalText);
    
    // Show legend and entity list
    legend.classList.remove('hidden');
    entityList.classList.remove('hidden');
}

// Populate entity table
function populateEntityTable(entities, originalText) {
    entityTableBody.innerHTML = '';
    
    entities.forEach(entity => {
        const row = document.createElement('tr');
        const entityConfig = ENTITY_TYPES[entity.label] || {
            badgeClass: 'unknown',
            label: entity.label
        };
        
        const entityText = originalText.substring(entity.start, entity.end);
        
        row.innerHTML = `
            <td><span class="entity-badge ${entityConfig.badgeClass}">${entity.label}</span></td>
            <td>${escapeHtml(entityText)}</td>
            <td>${entity.start}</td>
            <td>${entity.end}</td>
        `;
        
        // Highlight the corresponding entity in the output when hovering over table row
        row.addEventListener('mouseenter', () => {
            const spans = outputText.querySelectorAll('span[data-entity-index]');
            const index = entities.indexOf(entity);
            if (spans[index]) {
                spans[index].style.outline = '2px solid #000';
                spans[index].style.outlineOffset = '2px';
            }
        });
        
        row.addEventListener('mouseleave', () => {
            const spans = outputText.querySelectorAll('span[data-entity-index]');
            spans.forEach(span => {
                span.style.outline = 'none';
            });
        });
        
        entityTableBody.appendChild(row);
    });
}

// Health check function
async function performHealthcheck() {
    setLoadingState(healthcheckBtn, true, 'Checking...');
    updateHealthStatus('loading', 'Checking health...');
    
    try {
        console.log('Checking health at:', HEALTH_ENDPOINT);
        
        const response = await fetch(HEALTH_ENDPOINT, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('Health response status:', response.status);
        console.log('Health response content-type:', response.headers.get('content-type'));
        
        // Verify content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Expected application/json, got ${contentType}`);
        }
        
        const data = await response.json();
        console.log('Health response data:', data);
        
        // Validate response according to contract
        if (response.ok && data && data.status === 'ok') {
            updateHealthStatus('healthy', 'Service is healthy');
            console.log('Healthcheck passed: {"status":"ok"}');
        } else {
            updateHealthStatus('unhealthy', `Service unhealthy (${response.status})`);
            console.error('Healthcheck failed:', data);
        }
    } catch (error) {
        console.error('Healthcheck error:', error);
        updateHealthStatus('unhealthy', `Healthcheck failed: ${error.message}`);
    } finally {
        setLoadingState(healthcheckBtn, false, 'Healthcheck');
    }
}

// Update health status indicator
function updateHealthStatus(status, text) {
    statusDot.className = 'status-dot';
    
    switch (status) {
        case 'healthy':
            statusDot.classList.add('healthy');
            break;
        case 'unhealthy':
            statusDot.classList.add('unhealthy');
            break;
        case 'loading':
            statusDot.classList.add('loading');
            break;
    }
    
    statusText.textContent = text;
}

// Set loading state for buttons
function setLoadingState(button, isLoading, loadingText) {
    if (isLoading) {
        button.disabled = true;
        const originalContent = button.innerHTML;
        button.dataset.originalContent = originalContent;
        button.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    } else {
        button.disabled = false;
        if (button.dataset.originalContent) {
            button.innerHTML = button.dataset.originalContent;
        }
    }
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

// Hide error message
function hideError() {
    errorMessage.classList.add('hidden');
}

// Generate unique hash for request
function generateHash() {
    return `visualizer-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize with sample text
function initializeSample() {
    const sampleText = 'Ali Toshkent shahrida ishlaydi. Alisher Navoiy haqida maqola.';
    inputText.value = sampleText;
    inputText.placeholder = 'Type or paste text here... (e.g., Ali Toshkent shahrida ishlaydi.)';
}

// Call initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeSample();
    console.log('NER Visualizer initialized');
    console.log('Using NGINX proxy for API requests');
    console.log(`Predict endpoint: ${PREDICT_ENDPOINT}`);
    console.log(`Health endpoint: ${HEALTH_ENDPOINT}`);
    console.log('Following HTTP API contract');
});
