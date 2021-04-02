const initialDiv = document.getElementById("initial");
const authButton = document.getElementById("authButton");
const postAuthDiv = document.getElementById("postAuth");

document.addEventListener('DOMContentLoaded', function () {
    if(isAuthenticated == "true") {
        initialDiv.style.display = "none";
        postAuthDiv.style.display = "block";
        document.getElementById("usernameHeader").innerHTML = "sheldor1510"
    } else {
        initialDiv.style.display = "block";
    }
})

window.addEventListener("message", async (event) => {
    const message = event.data;
    switch (message.type) {
        case "username":
            const username = message.value;
            authButton.style.display = "none";
            initialDiv.style.display = "none";
            postAuthDiv.style.display = "block";
            document.getElementById("usernameHeader").innerHTML = username
    }
})

document.addEventListener("click", function (e) {
    if (e.target.id == "authButton") {
        console.log("auth")
        tsvscode.postMessage({ type: 'auth' });
    }
})

