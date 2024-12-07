// Add a listener for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startHack") {
    // Check if the element with class "overlayer active" exists
    // To ensure the user can't start if the countdown for the game still exists
    const overlayerElement = document.querySelector(".overlayer.active");

    if (overlayerElement) {
      alert("Game still in progress");
    } else {
      hack();
    }
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
        action: "updateSpeedAndBlock",
        speed: intervalValue,
      });

      const intervalId = setInterval(() => {
        // Get all elements with the class "map"
        const mapElements = document.querySelectorAll(".map");

        // Iterate over each map element
        mapElements.forEach((mapElement) => {
          // Get all elements that have BOTH "player-end" and "player-me" classes
          const playerEndMeElements = mapElement.querySelectorAll(
            ".player-end.player-me"
          );

          // Check if there are any elements with both classes
          if (playerEndMeElements.length > 0) {
            // User has both classes, clear the interval
            console.log("User  has both player-end and player-me classes.");
            clearInterval(intervalId); // Stop the interval
          } else {
            // User doesn't have both classes
            console.log(
              "User  doesn't have both player-end and player-me classes."
            );
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
              action: "updateSpeedAndBlock",
              speed: intervalValue,
            });
          }
        });
      }, intervalValue);
    });
  }

  // Starten Sie das Intervall
  startInterval();
}
