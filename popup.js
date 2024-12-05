document.getElementById("goToFAQ").addEventListener("click", function () {
    // Send a message to the content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "startHack" });
    });
    document.getElementById("goToFAQ").style.backgroundColor="yellow";
    document.getElementById("goToFAQ").style.borderColor="yellow";
    document.getElementById("goToFAQ").style.color="black";
    document.getElementById("goToFAQ").innerHTML="Hack started"
  });