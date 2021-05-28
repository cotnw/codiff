# CoDiff
CoDiff is a VSCode extension that has live access to all your teammates' local changes, greatly improving communication: it notifies you of conflicts with teammates as they occur. Download the extension from [here](https://marketplace.visualstudio.com/items?itemName=bar9.codiff).

## Features
- Use your GitHub account to log in.
- Start conflict detection on any git initialized repository.
- Get notified when another user saves the same file that you are working on.
- Whenever you save a particular file you will be notified if you conflict with a previously saved local version.
- View conflicts between your version and the saved version of one of the collaborators.
- Receive notification asking you to pull changes if your local version is behind some commits compared to the one on GitHub.
- Access the sidebar from where you can start conflict detection and view other details regarding the room you are in which includes the room ID, git repo url, branch and revision ID.

## Screenshots
![](https://media.discordapp.net/attachments/706928005313855620/846836626683330570/unknown.png?width=379&height=90)

Conflict notification

![](https://media.discordapp.net/attachments/706928005313855620/846837133045792776/unknown.png?width=363&height=34)

File saving notification

![](https://media.discordapp.net/attachments/706928005313855620/846837601574060032/unknown.png?width=641&height=350)

Viewing conflicts

## Dependencies
- polka
- axios
- socket.io-client
- tmp

## Run it locally
1. Run `npm i`
2. Run the extension

## Contributing
We, as developers, want to give you the best possible user experience, and thus we encourage you to open issues on our GitHub repository for any bugs, crashes, or anomalous behavior which you face.

API repository is available [here](https://github.com/cotnw/codiff-api).
