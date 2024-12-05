// Add a listener for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startHack") {
    hack();
  }
});

// The rest of your hack function remains unchanged
function hack() {
  // -- ID is added automatically after running to the input field by searching for class where input field is inside, locate input field and add an ID to it --
  const inputField = document.querySelector(".interface input");

  if (inputField) {
    inputField.id = "inputfield";
  }

  function getRandomInterval() {
    return Math.floor(Math.random() * 300) + 500;
  }

  const intervalId = setInterval(() => {
    const highlightedText = document.querySelector(".highlight").textContent;

    if (highlightedText) {
      inputField.focus();
      inputField.value = highlightedText + " ";

      const inputEvent = new Event("input", { bubbles: true });
      inputField.dispatchEvent(inputEvent);
    }
  }, getRandomInterval());

  inputField.addEventListener("blur", () => {
    clearInterval(intervalId);
  });
}
