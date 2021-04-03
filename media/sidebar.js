const initialDiv = document.getElementById("initial");
const authButton = document.getElementById("authButton");
const postAuthDiv = document.getElementById("postAuth");

document.addEventListener('DOMContentLoaded', function () {
    const token = document.getElementById("token").innerHTML
    console.log("TOKEN", token)
    if(token == "null") {
        initialDiv.style.display = "block";
    } else {
        initialDiv.style.display = "none";
        postAuthDiv.style.display = "block";
        var myHeaders = new Headers();
        myHeaders.append("Authorization", `token ${token}`);

        var requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        fetch("https://api.github.com/user", requestOptions)
        .then(async (result) => {
            const user = await result.json()
            document.getElementById("pfp").src = "https://github.com/"+user.login+".png";
            document.getElementById("usernameHeader").innerHTML = user.login
        })
        .catch(error => console.log('error', error));
        
    }
})

document.addEventListener("click", function (e) {
    if (e.target.id == "authButton") {
        console.log("auth")
        tsvscode.postMessage({ type: 'auth' });
    }
    if(e.target.id == "logoutButton") {
        console.log("logout")
        tsvscode.postMessage({ type: 'logout' })
    }
})

