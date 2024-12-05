// Add a listener for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startHack") {
    hack();
  }
});

function hack() {
  function getRandomInterval() {
    return Math.floor(Math.random() * 250) + 250;
  }

  // Funktion zum Starten des Intervalls
  function startInterval() {
    chrome.storage.local.get("randomly", (data) => {
      const randomly = data.randomly; // Wert aus chrome.storage abrufen
      let intervalValue = randomly ? getRandomInterval() : 250; // Intervallwert setzen

      // Sende den initialen Intervallwert an das Popup
      chrome.runtime.sendMessage({
        action: "updateSpeed",
        speed: intervalValue,
      });

      const intervalId = setInterval(() => {
        const highlightedText =
          document.querySelector(".highlight").textContent;
        const inputField = document.querySelector(".interface input");

        if (highlightedText) {
          inputField.focus();
          inputField.value = highlightedText + " ";

          const inputEvent = new Event("input", { bubbles: true });
          inputField.dispatchEvent(inputEvent);
        }

        // Aktualisiere den Intervallwert, wenn randomly true ist
        if (randomly) {
          intervalValue = getRandomInterval(); // Neuen zufälligen Intervallwert generieren
        }

        // Sende den aktuellen Intervallwert an das Popup
        chrome.runtime.sendMessage({
          action: "updateSpeed",
          speed: intervalValue,
        });
      }, intervalValue);
    });
  }

  // Starten Sie das Intervall
  startInterval();
}
