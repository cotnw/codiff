import * as vscode from 'vscode';
import { SidebarProvider } from "./SidebarProvider";
import { Util, getGit } from "./util";
import { apiBaseUrl, saveObjectKey, codiffGlobalsObjectKey } from './constants';
const io = require("socket.io-client");

export async function activate(context: vscode.ExtensionContext) {
	console.log('CoDiff is now active!');

	Util.context = context;

	if (!Util.isLoggedIn()) {
		console.log("The user isn't logged in.")
	} else {
		console.log("The user is logged in.")
		console.log("Access Token:" ,Util.getAccessToken())
	}

	const socket = io.connect(apiBaseUrl);
	console.log('Socket initialized.');
	
	console.log("Save Object:")
	console.log(Util.getSaveObject())
	console.log("Codiff Globals Object:")
	console.log(Util.getcodiffGlobals())

	vscode.commands.executeCommand("codiff.start");

	context.subscriptions.push(
		vscode.commands.registerCommand('codiff.start', async () => {
			const choice = await vscode.window.showInformationMessage(
				"Would you like to start conflict detection for this branch and repository?",
				"Yes",
				"No"
			);
			if (choice === "Yes") {
				const git = await getGit();
		
				if (git?.repositories.length) {
					let repoUrl = git.repositories.find((repo) => repo.ui.selected)?.state.remotes[0].fetchUrl
					if (repoUrl) {
						repoUrl = repoUrl.replace('git@', 'https://').replace('.git', '')
					}
					const localRepoURL = repoUrl
					const localBranchName = git.repositories.find((repo) => repo.ui.selected)?.state.HEAD?.name
					const localRevisionID =  git.repositories.find((repo) => repo.ui.selected)?.state.HEAD?.commit
					const gitObject = {
						git_repo_url: localRepoURL,
						branch: localBranchName,
						revision_id: localRevisionID
					}
					const codiffGlobals = {
						git_repo_url: localRepoURL,
						branch: localBranchName,
						revision_id: localRevisionID,
						extension_status: "active"
					}
					await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
					const repoName = localRepoURL?.split('github.com/')[1]
					vscode.window.showInformationMessage(`Conflict detection has started for ${localBranchName} branch of ${repoName}.`)
				} else {
					const codiffGlobals = {
						extension_status: "inactive"
					}
					await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
					vscode.window.showErrorMessage("Conflict detection couldn't be started as this is not a git initialized repository")
				}
			} else {
				const codiffGlobals = {
					extension_status: "inactive"
				}
				await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
			}
			console.log("Updated codiff globals object:")
			console.log(Util.getcodiffGlobals())
		})
	)

	const sidebarProvider = new SidebarProvider(context.extensionUri);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("codiff-sidebar", sidebarProvider)
	);
	
	context.subscriptions.push(
		vscode.commands.registerCommand('codiff.clearGlobalStorage', async () => {
			await Util.context.globalState.update(saveObjectKey, undefined).then(() => console.log(Util.getSaveObject()));
		})
	)
	
	socket.on('save', async (message: { username: string; relativePath: string; code: string }) => {
		var saveObj: {[key: string] : any} = Util.getSaveObject()
		var keyWasFound = false
		var fileSavesArrayUpdated = false
		Object.keys(saveObj).forEach((key: string) => {
			if(key == message.relativePath) {
				keyWasFound = true
				const fileSavesArray = saveObj[key]
				for(let i=0;i < fileSavesArray.length;i++) {
					if(fileSavesArray[i]["username"] == message.username) {
						fileSavesArrayUpdated = true
						fileSavesArray[i]["code"] = message.code
					} 
				}
				if(!fileSavesArrayUpdated) {
					fileSavesArray.push({username: message.username, code: message.code})
				}
			} 
		})
		if(!keyWasFound) {
			saveObj[message.relativePath] = [{username: message.username, code: message.code}]
		}
		await Util.context.globalState.update(saveObjectKey, saveObj);
		console.log('updated')
		console.log(Util.getSaveObject())
		const workspaceFolders = vscode.workspace.workspaceFolders
		if(workspaceFolders != undefined) {
			const rootPath = workspaceFolders[0].uri.path.substring(1).split('/').join("\\")
			const relativePath = vscode.window.activeTextEditor?.document.fileName.split(rootPath)[1].substring(1)
			if(message.relativePath == relativePath) {
				vscode.window.showInformationMessage(`${message.username} just saved this file. Save your version to check for conflicts.`)
			}
		}
	})

	// write on didChangeActiveEditorEvent which checks the current git object and the git object in the global storage and triggers codiff.start if they are different.

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(async document => {
			var codiffGlobals: {[key: string] : any} = Util.getcodiffGlobals()
			var extensionStatus = codiffGlobals['extension_status']
			if(extensionStatus != "inactive") {
				const workspaceFolders = vscode.workspace.workspaceFolders
				if(workspaceFolders != undefined) {
					const rootPath = workspaceFolders[0].uri.path.substring(1).split('/').join("\\")
					const relativePath = document.fileName.split(rootPath)[1].substring(1)
					var saveObj: {[key: string] : any} = Util.getSaveObject()
					var conflicts: Array<{code: any, username: any}> = []
					var ext = '.' + relativePath.split(".")[1]

					Object.keys(saveObj).forEach((key: string) => {
						if(key == relativePath) {
							const fileSavesArray = saveObj[key]
							for(let i=0;i < fileSavesArray.length;i++) {
								const conflict: {code: any, username: any} = {
									code: saveObj[key][i]["code"],
									username: saveObj[key][i]["username"]
								}
								conflicts.push(conflict)
							}
						}
					});
					
					var savedCode = document.getText()
					socket.emit('save', {username: "sheldor1510", relativePath, code: savedCode})
					console.log('save event socket message sent')

					for(let i=0; i<conflicts.length;i++) {
						var code = conflicts[i].code
						var username = conflicts[i].username
						if(code != savedCode) {
							const writeData = Buffer.from(code, 'utf8')
							var tmp = require("tmp")
							var tmpFilePath = tmp.tmpNameSync({ postfix: ext });
							const sampleFileUri = vscode.Uri.file(tmpFilePath)
							vscode.workspace.fs.writeFile(sampleFileUri, writeData)
							const choice = await vscode.window.showInformationMessage(
								`Your code appears to have a conflict with ${username}'s recently saved version of this file. Would you like to view the conflicts?`,
								"Yes",
								"View later",
								"Don't show again"
							);
							if (choice === "Yes") {
								vscode.commands.executeCommand("vscode.diff", sampleFileUri, document.uri, `Difference between ${username}'s and your version`)
							}
							if(choice === "Don't show again") {
								var saveObj: {[key: string] : any} = Util.getSaveObject()
								Object.keys(saveObj).forEach((key: string) => {
									if(key == relativePath) {
										const fileSavesArray = saveObj[key]
										for(let i=0;i < fileSavesArray.length;i++) {
											if(fileSavesArray[i].username == username) {
												fileSavesArray.splice(i, 1)
											}
										}
									}
								});
								console.log(saveObj)
								await Util.context.globalState.update(saveObjectKey, saveObj);
								console.log('updated after dont show again')
								console.log(Util.getSaveObject())
							}
						} else {
							console.log("code was same")
						}
					}
				}
			}
		})
	)

}

export function deactivate() {}
