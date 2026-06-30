
# D3VONN Chrome Extension Documentation

## Overview

The D3VONN Chrome Extension provides seamless access to D3VONN functionality directly from your browser. This documentation covers installation, configuration, usage, and troubleshooting for end users and developers.

## Installation

### Standard Installation
1. Download the extension from the Chrome Web Store
2. Click "Add to Chrome" to install

### Developer Installation
1. Clone or download the repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the folder containing the extension files

## Configuration Options

### API Connection
| Setting | Description | Default Value |
|---------|-------------|---------------|
| API URL | The URL for the D3VONN backend API | https://api.d3vonn.io |
| User ID | Your unique D3VONN user identifier | N/A (Required) |

### Notification Settings
| Setting | Description | Default Value |
|---------|-------------|---------------|
| Task Completion | Receive notifications when AI tasks are completed | Enabled |
| Error Alerts | Receive notifications for errors and warnings | Enabled |

### Advanced Options
| Setting | Description | Default Value |
|---------|-------------|---------------|
| Check Frequency | How often to check for updates (in minutes) | 30 |
| Debug Mode | Enable verbose console logging | Disabled |

## Usage Guide

### Main Interface
1. Click the D3VONN icon in your browser toolbar to open the extension popup
2. The main interface displays:
   - Available agents
   - Recent tasks
   - Quick actions

### Working with Agents
1. Select an agent from the dropdown menu
2. Enter your task in the text input area
3. Click "Run Task" to execute
4. View results in the output panel

### Memory & Knowledge
1. Click the "Memory" tab to view agent memory
2. Use the search function to find specific memories
3. Click on memory items to expand details

### Tools & Integration
1. Click the "Tools" tab to see available tools
2. Enable or disable tools using the toggles
3. Configure tool-specific settings as needed

## Troubleshooting

### Common Issues

**Extension Not Connecting to API**
- Verify your API URL in the settings
- Check your internet connection
- Ensure your User ID is correct

**Tasks Not Completing**
- Check the console for error messages
- Verify the agent has the necessary permissions
- Try restarting the browser

### Error Codes

| Code | Description | Recommended Action |
|------|-------------|-------------------|
| E001 | API Connection Failed | Check API URL and internet connection |
| E002 | Authentication Error | Verify User ID and permissions |
| E003 | Task Execution Failed | Review task parameters and try again |

## Developer Documentation

### Extension Structure
```
├── manifest.json         # Extension configuration
├── popup.html            # Main popup UI
├── popup.js              # Popup functionality
├── popup.css             # Popup styling
├── background.js         # Background service worker
├── settings.html         # Settings page
├── settings.js           # Settings functionality
├── settings.css          # Settings styling
└── icons/                # Extension icons
```

### Custom Events
| Event Name | Description | Data Payload |
|------------|-------------|--------------|
| d3vonn:task:complete | Fired when a task is completed | `{ taskId, result, timestamp }` |
| d3vonn:agent:update | Fired when agent state changes | `{ agentId, status, memory }` |

### Storage Schema
The extension uses Chrome's `storage.local` API with the following structure:
```json
{
  "settings": {
    "apiUrl": "https://api.d3vonn.io",
    "userId": "user-guid",
    "notifications": {
      "taskComplete": true,
      "errors": true
    },
    "lastCheck": 1649012345678
  },
  "agents": [...],
  "tasks": [...],
  "memory": [...]
}
```

## Version History

| Version | Release Date | Key Features |
|---------|--------------|-------------|
| 1.0.0   | 2023-04-01   | Initial release with basic functionality |
| 1.1.0   | 2023-05-15   | Added memory browsing and search |
| 1.2.0   | 2023-07-01   | Integrated with tool system |

## Support & Resources

- [Official Documentation](https://docs.d3vonn.io/extension)
- [GitHub Repository](https://github.com/d3vonn/chrome-extension)
- [Issue Tracker](https://github.com/d3vonn/chrome-extension/issues)
- [Community Forum](https://community.d3vonn.io)
