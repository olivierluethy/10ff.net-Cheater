"use strict";

document.getElementById("startHack").addEventListener("click", function () {
  // Send a message to the content script
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: "startHack" });
  });
  const startHackButton = document.getElementById("startHack");

  startHackButton.style.backgroundColor = "white";
  startHackButton.style.borderColor = "1px solid black";
  startHackButton.style.color = "black";
  startHackButton.innerHTML = "Hack started";
  startHackButton.disabled = true;

  document.getElementById("checkbox-subs").disabled = true;
});

function updateToggleText(randomly) {
  const toggleElement = document.getElementById("toggOnOff");
  toggleElement.innerHTML = randomly
    ? "Speed Randomly <strong>On</strong>"
    : "Speed Randomly <strong>Off</strong>";

  const switchElement = document.querySelector(".switch");
  switchElement.title = randomly
    ? "Speed is random. Click to set the speed to permanent!"
    : "Speed is permanent. Click to set the speed to random!";
}

document.addEventListener("DOMContentLoaded", () => {
  const startHackButton = document.getElementById("startHack");
  const gameRestartButton = document.getElementById("gameRestart");
  const checkboxSubs = document.getElementById("checkbox-subs");
  const intSpeed = document.getElementById("intSpeed");

  if (intSpeed) {
    intSpeed.textContent = "";
  }

  // Initialisiere den Text beim Laden der Seite
  chrome.storage.local.get("randomly", (data) => {
    const randomly = data.randomly !== undefined ? data.randomly : true; // Standardwert ist true
    checkboxSubs.checked = randomly; // Setze den Status der Checkbox
    updateToggleText(randomly); // Aktualisiere den Text sofort
  });

  // Event Listener für Änderungen an der Checkbox
  checkboxSubs.addEventListener("change", () => {
    const isChecked = checkboxSubs.checked;
    chrome.storage.local.set({ randomly: isChecked }); // Speichern in Storage
    updateToggleText(isChecked); // Aktualisiere den Text sofort
  });

  // Initiale Blockadeprüfung
  chrome.storage.local.get(["settingsBlocked"], (data) => {
    const settingsBlocked = data.settingsBlocked || false;
    updateUI(settingsBlocked);
  });

  // Listener für Änderungen in Chrome Storage
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.settingsBlocked) {
      const settingsBlocked = changes.settingsBlocked.newValue;
      updateUI(settingsBlocked);
    }
  });

  // Funktion zur Aktualisierung der UI
  function updateUI(settingsBlocked) {
    if (settingsBlocked) {
      // Blockiere die Einstellungen
      const gradient = "radial-gradient(circle, #f08080, #ff0000)";
      startHackButton.style.backgroundImage = gradient;
      startHackButton.style.borderColor = "1px solid white";
      startHackButton.style.color = "white";
      startHackButton.innerHTML = "Race finished!";
      startHackButton.disabled = true;

      intSpeed.textContent = "";

      checkboxSubs.disabled = true;
      gameRestartButton.style.display = "inline-block";
    } else {
      // Entblockiere die Einstellungen
      startHackButton.style.backgroundImage = "";
      startHackButton.style.borderColor = "";
      startHackButton.style.color = "";
      startHackButton.innerHTML = "Start Hack";
      startHackButton.disabled = false;

      checkboxSubs.disabled = false;
      gameRestartButton.style.display = "none";
    }
  }

  // Event Listener für "Game Restart"-Button
  gameRestartButton.addEventListener("click", () => {
    chrome.storage.local.set({ settingsBlocked: false }, () => {
      console.log("Game restarted, settings unblocked.");
    });
  });
});

const restartButton = document.getElementById("gameRestart");

restartButton.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      // Neuladen der aktuellen Webseite
      chrome.tabs.reload(tabs[0].id);
    }
  });
});

// Listener für Nachrichten vom Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSpeedAndBlock") {
    // Aktualisiere die Geschwindigkeit
    document.getElementById(
      "intSpeed"
    ).textContent = `Current Speed: ${request.speed}`;

    // Blockiere die Einstellungen
    const startHackButton = document.getElementById("startHack");
    startHackButton.style.backgroundColor = "white";
    startHackButton.style.borderColor = "1px solid black";
    startHackButton.style.color = "black";
    startHackButton.innerHTML = "Hack started";
    startHackButton.disabled = true;

    document.getElementById("checkbox-subs").disabled = true;
  }
});
