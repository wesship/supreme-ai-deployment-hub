
// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const agentsList = document.getElementById('agents-list');
  const toolsList = document.getElementById('tools-list');
  const memoriesList = document.getElementById('memories-list');
  const taskDescription = document.getElementById('task-description');
  const runTaskBtn = document.getElementById('run-task-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const connectionStatus = document.getElementById('connection-status');
  const agentsLoading = document.getElementById('agents-loading');
  const toolsLoading = document.getElementById('tools-loading');
  const memorySearch = document.getElementById('memory-search');
  const searchBtn = document.getElementById('search-btn');
  
  let selectedAgentId = null;
  
  // Initialize
  checkConnectionStatus();
  loadAgents();
  loadTools();
  
  // Tab switching functionality
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Show corresponding content
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
      
      // Load content based on tab
      if (tabId === 'memory' && selectedAgentId) {
        loadMemories(selectedAgentId);
      }
    });
  });
  
  // Run task button
  runTaskBtn.addEventListener('click', () => {
    if (!selectedAgentId || !taskDescription.value.trim()) {
      return;
    }
    
    const task = {
      agentId: selectedAgentId,
      task: {
        task_description: taskDescription.value.trim()
      }
    };
    
    runTaskBtn.disabled = true;
    runTaskBtn.textContent = 'Running...';
    
    chrome.runtime.sendMessage(
      { action: 'runTask', agentId: selectedAgentId, task: task.task },
      response => {
        runTaskBtn.disabled = false;
        runTaskBtn.textContent = 'Run Task';
        
        if (response && response.success) {
          showNotification('Task completed', response.result.output);
        } else {
          showNotification('Error', response.error || 'Failed to run task');
        }
      }
    );
  });
  
  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Memory search
  searchBtn.addEventListener('click', () => {
    if (!memorySearch.value.trim()) return;
    
    searchMemories(memorySearch.value.trim());
  });
  
  memorySearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchBtn.click();
    }
  });
  
  // Load agents from API
  function loadAgents() {
    agentsLoading.style.display = 'block';
    agentsList.innerHTML = '';
    
    chrome.storage.local.get(['apiUrl'], async function(result) {
      const apiUrl = result.apiUrl || 'http://localhost:8000';
      
      try {
        const response = await fetch(`${apiUrl}/agents`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const data = await response.json();
        
        if (data.agents && data.agents.length > 0) {
          data.agents.forEach(agent => {
            const agentItem = createAgentItem(agent);
            agentsList.appendChild(agentItem);
          });
          
          // Enable task button if there are agents
          runTaskBtn.disabled = false;
        } else {
          agentsList.innerHTML = '<p class="text-center text-gray-500">No agents available</p>';
        }
      } catch (error) {
        console.error('Error loading agents:', error);
        agentsList.innerHTML = `<p class="text-center text-red-500">Failed to load agents: ${error.message}</p>`;
        updateConnectionStatus(false, `Error: ${error.message}`);
      } finally {
        agentsLoading.style.display = 'none';
      }
    });
  }
  
  // Load tools from API
  function loadTools() {
    toolsLoading.style.display = 'block';
    toolsList.innerHTML = '';
    
    chrome.storage.local.get(['apiUrl'], async function(result) {
      const apiUrl = result.apiUrl || 'http://localhost:8000';
      
      try {
        const response = await fetch(`${apiUrl}/tools`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const data = await response.json();
        
        if (data.tools && data.tools.length > 0) {
          data.tools.forEach(tool => {
            const toolItem = createToolItem(tool);
            toolsList.appendChild(toolItem);
          });
        } else {
          toolsList.innerHTML = '<p class="text-center text-gray-500">No tools available</p>';
        }
      } catch (error) {
        console.error('Error loading tools:', error);
        toolsList.innerHTML = `<p class="text-center text-red-500">Failed to load tools: ${error.message}</p>`;
      } finally {
        toolsLoading.style.display = 'none';
      }
    });
  }
  
  // Load memories for a specific agent
  function loadMemories(agentId) {
    memoriesList.innerHTML = '<p class="text-center">Loading memories...</p>';
    
    chrome.storage.local.get(['apiUrl'], async function(result) {
      const apiUrl = result.apiUrl || 'http://localhost:8000';
      
      try {
        const response = await fetch(`${apiUrl}/agents/${agentId}/memory`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const data = await response.json();
        
        if (data.memories && data.memories.length > 0) {
          memoriesList.innerHTML = '';
          data.memories.forEach(memory => {
            const memoryItem = createMemoryItem(memory);
            memoriesList.appendChild(memoryItem);
          });
        } else {
          memoriesList.innerHTML = '<p class="text-center text-gray-500">No memories found</p>';
        }
      } catch (error) {
        console.error('Error loading memories:', error);
        memoriesList.innerHTML = `<p class="text-center text-red-500">Failed to load memories: ${error.message}</p>`;
      }
    });
  }
  
  // Search memories
  function searchMemories(query) {
    memoriesList.innerHTML = '<p class="text-center">Searching...</p>';
    
    chrome.storage.local.get(['apiUrl'], async function(result) {
      const apiUrl = result.apiUrl || 'http://localhost:8000';
      
      try {
        const response = await fetch(`${apiUrl}/memory/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const data = await response.json();
        
        if (data.memories && data.memories.length > 0) {
          memoriesList.innerHTML = '';
          data.memories.forEach(memory => {
            const memoryItem = createMemoryItem(memory);
            memoriesList.appendChild(memoryItem);
          });
        } else {
          memoriesList.innerHTML = '<p class="text-center text-gray-500">No results found</p>';
        }
      } catch (error) {
        console.error('Error searching memories:', error);
        memoriesList.innerHTML = `<p class="text-center text-red-500">Search failed: ${error.message}</p>`;
      }
    });
  }
  
  // Create agent list item
  function createAgentItem(agent) {
    const agentItem = document.createElement('div');
    agentItem.className = 'agent-item';
    agentItem.dataset.id = agent.id;
    
    const agentName = document.createElement('div');
    agentName.className = 'agent-name';
    agentName.textContent = agent.name;
    
    const agentDesc = document.createElement('div');
    agentDesc.className = 'agent-desc';
    agentDesc.textContent = agent.desc || 'No description available';
    
    agentItem.appendChild(agentName);
    agentItem.appendChild(agentDesc);
    
    agentItem.addEventListener('click', () => {
      // Remove selected class from all agents
      document.querySelectorAll('.agent-item').forEach(item => {
        item.classList.remove('selected');
      });
      
      // Add selected class to clicked agent
      agentItem.classList.add('selected');
      selectedAgentId = agent.id;
      
      // Enable run task button
      runTaskBtn.disabled = false;
    });
    
    return agentItem;
  }
  
  // Create tool list item
  function createToolItem(tool) {
    const toolItem = document.createElement('div');
    toolItem.className = 'tool-item';
    
    const toolName = document.createElement('div');
    toolName.className = 'agent-name'; // Reuse the same style
    toolName.textContent = tool.name;
    
    const toolDesc = document.createElement('div');
    toolDesc.className = 'agent-desc'; // Reuse the same style
    toolDesc.textContent = tool.description || 'No description available';
    
    toolItem.appendChild(toolName);
    toolItem.appendChild(toolDesc);
    
    return toolItem;
  }
  
  // Create memory list item
  function createMemoryItem(memory) {
    const memoryItem = document.createElement('div');
    memoryItem.className = 'memory-item';
    
    const memoryContent = document.createElement('div');
    memoryContent.className = 'memory-content';
    memoryContent.textContent = memory.content;
    
    const memoryMeta = document.createElement('div');
    memoryMeta.className = 'memory-meta';
    
    const memoryContext = document.createElement('span');
    memoryContext.textContent = memory.context || 'No context';
    
    const memoryDate = document.createElement('span');
    const date = new Date(memory.timestamp);
    memoryDate.textContent = date.toLocaleString();
    
    memoryMeta.appendChild(memoryContext);
    memoryMeta.appendChild(memoryDate);
    
    memoryItem.appendChild(memoryContent);
    memoryItem.appendChild(memoryMeta);
    
    return memoryItem;
  }
  
  // Check connection status
  function checkConnectionStatus() {
    chrome.storage.local.get(['apiUrl'], async function(result) {
      const apiUrl = result.apiUrl || 'http://localhost:8000';
      
      try {
        const response = await fetch(`${apiUrl}/health-check`, { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        updateConnectionStatus(response.ok);
      } catch (error) {
        console.error('Connection check failed:', error);
        updateConnectionStatus(false);
      }
    });
  }
  
  // Update connection status display
  function updateConnectionStatus(isConnected, message = '') {
    if (isConnected) {
      connectionStatus.textContent = 'Connected';
      connectionStatus.classList.add('connected');
      connectionStatus.classList.remove('error');
    } else {
      connectionStatus.textContent = message || 'Not connected';
      connectionStatus.classList.add('error');
      connectionStatus.classList.remove('connected');
    }
  }
  
  // Show notification
  function showNotification(title, message) {
    chrome.storage.local.get(['notifications'], function(result) {
      const notificationSettings = result.notifications || { taskComplete: true, errors: true };
      
      if ((title.includes('Error') && notificationSettings.errors) || 
          (!title.includes('Error') && notificationSettings.taskComplete)) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: title,
          message: message
        });
      }
    });
  }
});
