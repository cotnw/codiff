const initialDiv = document.getElementById("initial");
const authButton = document.getElementById("authButton");
const postAuthDiv = document.getElementById("postAuth");

document.addEventListener('DOMContentLoaded', function () {
    const token = document.getElementById("token").innerHTML
    console.log("TOKEN", token)
    if(token == undefined) {
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
            tsvscode.postMessage({ type: 'refresh' });
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
    if(e.target.id == "startButton") {
        console.log("start")
        tsvscode.postMessage({ type: 'startConflictDetection' })
    }
    if(e.target.id == "stopButton") {
        console.log("stop")
        tsvscode.postMessage({ type: 'stopConflictDetection' })
        document.getElementById('startButtonArea').style.display = 'block'
        document.getElementById('more').style.display = 'none'
    }
})

window.addEventListener('message', event => {
    const data = event.data.data; 
    document.getElementById('startButtonArea').style.display = 'none'
    document.getElementById('more').innerHTML = `<br><p><b>room_id<br></b>${data.room_id}</p><br><p><b>git_repo_url<br></b>${data.git_repo_url}</p><br><p><b>branch<br></b>${data.branch}</p><br><p><b>revision_id<br></b>${data.revision_id}</p><br><br><button id="stopButton">stop conflict detection</button><br><br><br><br>`
});
