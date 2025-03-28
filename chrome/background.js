const chromeTabs = chrome.tabs;
const checkIntervalMinutes = 10;
const alarmName = "checkWaybackStatus";

// Function to update the extension icon based on the response status
function updateIcon(responseStatus) {
  if (responseStatus === 200) {
    chrome.action.setIcon({
      path: {
        16: "images/icon16.png",
        48: "images/icon48.png",
        128: "images/icon128.png",
      },
    });
    chrome.action.setTitle({ title: "Xnl Reveal" });
  } else {
    chrome.action.setIcon({
      path: {
        16: "images/iconnoway16.png",
        48: "images/iconnoway48.png",
        128: "images/iconnoway128.png",
      },
    });
    chrome.action.setTitle({ title: "Xnl Reveal (Wayback down!)" });
  }
}

function checkWaybackStatus() {
  // Check if the Wayback CDX API is available
  fetch("https://web.archive.org/cdx/search/cdx?url=AVAILABLEORNOT")
    .then((response) => {
      updateIcon(response.status);
    })
    .catch((error) => {
      // Do nothing
    });
}

// Set up the initial alarm
chrome.alarms.create(alarmName, { periodInMinutes: checkIntervalMinutes });

// Add an event listener for the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === alarmName) {
    checkWaybackStatus();
  }
});

let contextMenuWayback = {
  id: "showWaybackEndpoints",
  title: "Get Wayback endpoints",
  contexts: ["all"],
};

let contextMenuHidden = {
  id: "showHiddenElements",
  title: "Show hidden elements",
  contexts: ["all"],
};

let contextMenuDisabled = {
  id: "enableDisabledElements",
  title: "Enable disabled elements",
  contexts: ["all"],
};

let contextMenuGoogle = {
  id: "showGoogleCache",
  title: "Show Google cache version",
  contexts: ["all"],
};

let contextMenuFofa = {
  id: "showFofaSearch",
  title: "Show FOFA domain search",
  contexts: ["all"],
};

let contextMenuWordlist = {
  id: "createWordList",
  title: "Create word list",
  contexts: ["all"],
};

let scopeContextMenuAction = "";
let scopeContextMenuHost = "";

// Remove the dynamic menu for adding/removing to scope
function removeContextMenu() {
  chrome.contextMenus.remove("dynamicScopeMenuItem", () => {
    if (chrome.runtime.lastError) {
      //Do nothing
    }
  });
}

// Function to create the dynamic context menu item
function createDynamicContextMenu(currentHost) {
  // Get the scopeType and scopeItems from storage
  chrome.storage.sync.get(["scopeType", "scopeItems"], (result) => {
    const scopeType = result.scopeType || "whitelist";
    const scopeItems = result.scopeItems || [];

    // Check if the current host is in the scopeItems
    const scopeHost = scopeItems.includes(currentHost);

    // Define the context menu title based on scopeType and host inclusion
    const contextMenuTitle = scopeHost
      ? `Remove ${currentHost} from ${scopeType}`
      : `Add ${currentHost} to ${scopeType}`;

    // Define your dynamic context menu item here
    let dynamicContextMenuItem = {
      id: "dynamicScopeMenuItem",
      title: contextMenuTitle,
      contexts: ["all"],
    };

    // Assign the scope action and host to global variables
    scopeContextMenuAction = scopeHost ? "Remove" : "Add";
    scopeContextMenuHost = currentHost;

    // Remove the existing scope context menu item
    removeContextMenu();

    chrome.contextMenus.create(dynamicContextMenuItem, () => {
      if (chrome.runtime.lastError) {
        //Do nothing
      }
    });
  });
}

// Check if the context menu items already exist
chrome.contextMenus.removeAll(() => {
  // Create context menu items after removing any existing ones
  chrome.contextMenus.create(contextMenuWayback);
  chrome.contextMenus.create(contextMenuHidden);
  chrome.contextMenus.create(contextMenuDisabled);
  chrome.contextMenus.create(contextMenuGoogle);
  chrome.contextMenus.create(contextMenuFofa);
  chrome.contextMenus.create(contextMenuWordlist);
});

chrome.contextMenus.onClicked.addListener(function (clickData) {
  // Find the active tab
  chromeTabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      // Execute the action for the context menu
      chrome.tabs.sendMessage(tabs[0].id, {
        action: clickData.menuItemId,
        scopeAction: scopeContextMenuAction,
        scopeHost: scopeContextMenuHost,
      });
    }
  });
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "removeScopeMenu") {
    chrome.action.setBadgeText({ text: "" }); // Reset the badge on the icon
    // Remove the existing scope context menu item
    removeContextMenu();
  }
  if (request.action === "getTabInfo") {
    chrome.action.setBadgeText({ text: "" }); // Reset the badge on the icon

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError) {
        console.error(
          "Xnl Reveal: An error occurred while querying tabs:",
          chrome.runtime.lastError
        );
        sendResponse({ error: chrome.runtime.lastError });
        return;
      }

      if (tabs && tabs[0]) {
        const currentHost = new URL(tabs[0].url).host;

        // Handle the tab information and send it back to the content script
        sendResponse({ currentHost });

        // Create the dynamic menu to add/remove the host to the white/black list
        // Only create if the current scope has a dot in it (e.g. ignore things like chome://extensions and about:addons)
        if (currentHost.includes(".")) {
          createDynamicContextMenu(currentHost.replace(/^www\./, ""));
        }
      } else {
        console.error("Xnl Reveal: No active tab found");
        sendResponse({ error: "Xnl Reveal: No active tab found" });
      }
    });

    // Indicate that you will respond asynchronously
    return true;
  }

  if (request.action === "fetchWaybackData") {
    const currentURL = request.location; // Get the current URL from the content script

    // Construct the URL for fetching Wayback Machine data
    const newURL = `https://web.archive.org/cdx/search/cdx?url=${currentURL}*&fl=original&collapse=urlkey&filter=!mimetype:warc/revisit|text/css|image/jpeg|image/jpg|image/png|image/svg.xml|image/gif|image/tiff|image/webp|image/bmp|image/vnd|image/x-icon|image/vnd.microsoft.icon|font/ttf|font/woff|font/woff2|font/x-woff2|font/x-woff|font/otf|audio/mpeg|audio/wav|audio/webm|audio/aac|audio/ogg|audio/wav|audio/webm|video/mp4|video/mpeg|video/webm|video/ogg|video/mp2t|video/webm|video/x-msvideo|video/x-flv|application/font-woff|application/font-woff2|application/x-font-woff|application/x-font-woff2|application/vnd.ms-fontobject|application/font-sfnt|application/vnd.android.package-archive|binary/octet-stream|application/octet-stream|application/pdf|application/x-font-ttf|application/x-font-otf|video/webm|video/3gpp|application/font-ttf|audio/mp3|audio/x-wav|image/pjpeg|audio/basic|application/font-otf&filter=!statuscode:404|301|302`;

    // Make the cross-origin request from the background script
    fetch(newURL)
      .then((response) => {
        const statusCode = response.status; // Get the HTTP status code

        // Process the Wayback data here
        return response.text().then((data) => {
          updateIcon(statusCode); // Call updateIcon with the status code
          return { waybackData: data };
        });
      })
      .then((result) => {
        // Continue with processing the response
        sendResponse(result);
      })
      .catch((error) => {
        // Handle any errors
        sendResponse({ error: error.message });
      });

    // Return true to indicate that we will use sendResponse asynchronously
    return true;
  }

  // Set the badge on the extension icon to the number of reflected parameters found
  if (request.action === "updateBadge") {
    const num = request.number; // Get the number of reflected parameters
    const sus = request.sus; // Get whether there were "sus" parameters
    chrome.action.setBadgeText({ text: String(num) });
    if (sus) {
      chrome.action.setBadgeBackgroundColor({ color: "red" });
    } else {
      chrome.action.setBadgeBackgroundColor({ color: "green" });
    }
  }
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  // Set defaults on installation
  chrome.storage.sync.set({ canaryToken: "xnlreveal" });
  chrome.storage.sync.set({ checkSpecialChars: false });
  chrome.storage.sync.set({ showAlerts: true });
  chrome.storage.sync.set({ copyToClipboard: false });
  chrome.storage.sync.set({ paramBlacklist: "" });
  chrome.storage.sync.set({ checkDelay: "2" });
  chrome.storage.sync.set({ waybackRegex: "" });
  chrome.storage.sync.set({ scopeType: "" });

  // Schedule the alarm on installation
  chrome.alarms.create(alarmName, { periodInMinutes: checkIntervalMinutes });
});
