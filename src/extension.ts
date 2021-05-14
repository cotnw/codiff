import * as vscode from 'vscode';
import { SidebarProvider } from "./SidebarProvider";
import { Util, getGit } from "./util";
import { apiBaseUrl, saveObjectKey, codiffGlobalsObjectKey } from './constants';
import axios from 'axios';
import { authenticate }  from './authenticate';
const io = require("socket.io-client");

export async function activate(context: vscode.ExtensionContext) {
	console.log('CoDiff is now active!');

	Util.context = context;

	console.log("Save Object:")
	await Util.context.globalState.update(saveObjectKey, undefined).then(() => console.log(Util.getSaveObject()));
	
	console.log("Codiff Globals Object:")
	await Util.context.globalState.update(codiffGlobalsObjectKey, undefined).then(() => console.log(Util.getcodiffGlobals()));

	if (!Util.isLoggedIn()) {
		const choice = await vscode.window.showInformationMessage(
			`You need to login to GitHub to start conflict detection, would you like to continue?`,
			"Yes",
			"Cancel"
		);
		if (choice === "Yes") {
			authenticate();
		} else {
			const codiffGlobals = {
				extension_status: "inactive",
				authenticated: false
			}
			await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
		}
	} else {
		const codiffGlobals = {
			extension_status: "inactive",
			authenticated: true
		}
		await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
	}

	const socket = io.connect(apiBaseUrl);
	console.log('Socket initialized.');
	
	vscode.commands.executeCommand('codiff.start');

	context.subscriptions.push(
		vscode.commands.registerCommand('codiff.start', async () => {
			var codiffGlobals: {[key: string] : any} = Util.getcodiffGlobals()
			var authenticated = codiffGlobals['authenticated']
			if(authenticated) {
				const choice = await vscode.window.showInformationMessage(
					"Would you like to start conflict detection for this branch and repository?",
					"Yes",
					"No"
				);
				if (choice === "Yes") {
					try {
						const git = await getGit();
				
						if (git?.repositories.length) {
							let repoUrl = git.repositories[0].state.remotes[0].fetchUrl
							if (repoUrl) {
								repoUrl = repoUrl.replace('git@', 'https://').replace('.git', '')
							}
							const localRepoURL = repoUrl
							const localBranchName = git.repositories[0].state.HEAD?.name
							const localRevisionID =  git.repositories[0].state.HEAD?.commit
							const repoName = localRepoURL?.split('github.com/')[1]
							const gitObject = {
								git_repo_url: localRepoURL,
								branch: localBranchName,
								revision_id: localRevisionID
							}
							console.log(localRepoURL)
							console.log(localBranchName)
							console.log(localRevisionID)
							axios.post(`${apiBaseUrl}/user/socket`, {accessToken: Util.getAccessToken(), socketID: socket.id})
							.then (response => {
								if(response.status == 200)  {
									axios.post(`${apiBaseUrl}/room/join?access_token=${Util.getAccessToken()}`, gitObject)
									.then(async function (response) {
										if(response.data.success) {
											console.log(response.data)
											socket.emit('join', {accessToken: Util.getAccessToken(), roomID: response.data.room_id})
											const codiffGlobals = {
												git_repo_url: localRepoURL,
												branch: localBranchName,
												revision_id: localRevisionID,
												extension_status: "active",
												room_id: response.data.room_id,
												authenticated: true
											}
											await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
											vscode.window.showInformationMessage(`Conflict detection has started for ${localBranchName} branch of ${repoName}.`)
											console.log("Updated codiff globals object:")
											console.log(Util.getcodiffGlobals())
											vscode.commands.executeCommand('codiff.refresh')
										} else {
											const codiffGlobals = {
												extension_status: "inactive",
												authenticated: true
											}
											await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
											console.log(response.data.error)
											vscode.window.showErrorMessage(`Conflict detection couldn't be started. Error: ${response.data.error}`)
											console.log("Updated codiff globals object:")
											console.log(Util.getcodiffGlobals())
										}
									})
									.catch(function (error) {
										console.log(error);
									});				
								} else {console.log(response.status)}
							})
							.catch(e => {
								console.log(e)
							})	
						} else {
							const codiffGlobals = {
								extension_status: "inactive",
								authenticated: true
							}
							await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
							vscode.window.showErrorMessage("Conflict detection couldn't be started. Error: This is not a git initialized repository")
						}
					} catch (error) {
						const codiffGlobals = {
							extension_status: "inactive",
							authenticated: true
						}
						await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
						vscode.window.showErrorMessage("Conflict detection couldn't be started. Try again from the sidebar.")
					}
				} else {
					const codiffGlobals = {
						extension_status: "inactive",
						authenticated: true
					}
					await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
				}
				console.log("Updated codiff globals object:")
				console.log(Util.getcodiffGlobals())
			}
		})
	)

	const sidebarProvider = new SidebarProvider(context.extensionUri);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("codiff-sidebar", sidebarProvider)
	);

	vscode.commands.registerCommand("codiff.refresh", () => {
		var codiffGlobals: {[key: string] : any} = Util.getcodiffGlobals()
		var extension_status = codiffGlobals['extension_status']
		
		if(extension_status == "active") {
			var room_id = codiffGlobals['room_id']
			var git_repo_url = codiffGlobals['git_repo_url']
			var branch = codiffGlobals['branch']
			var revision_id = codiffGlobals['revision_id']
			sidebarProvider._view?.webview.postMessage({
				data: {room_id, git_repo_url, branch, revision_id}
			});
		}
		
	});
	
	context.subscriptions.push(
		vscode.commands.registerCommand('codiff.clearGlobalStorage', async () => {
			await Util.context.globalState.update(saveObjectKey, undefined).then(() => console.log(Util.getSaveObject()));
		})
	)
	
	socket.on('push', async (message: { username: string }) => {
		const codiffGlobals = {
			extension_status: "inactive",
			authenticated: true
		}
		await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
		vscode.window.showErrorMessage(`Conflict detection has stopped for you since ${message.username} has recently pushed some changes. Pull those changes and then start conflict detection from the sidebar.`)
	})

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

	context.subscriptions.push(	
		vscode.workspace.onDidChangeTextDocument(async (e) => {
			var codiffGlobals: {[key: string] : any} = Util.getcodiffGlobals()
			var extensionStatus = codiffGlobals['extension_status']
			if(extensionStatus == "active") {
				const git = await getGit();
				if (git?.repositories.length) {
					let gitObject:{[key: string]: any} = {}
					if(git.repositories.find((repo) => repo.ui.selected)?.state == undefined) {
						let repoUrl = git.repositories[0].state.remotes[0].fetchUrl
						if (repoUrl) { 
							repoUrl = repoUrl.replace('git@', 'https://').replace('.git', '')
						}
						const localRepoURL = repoUrl
						const localBranchName = git.repositories[0].state.HEAD?.name
						const localRevisionID =  git.repositories[0].state.HEAD?.commit
						gitObject['git_repo_url'] =  localRepoURL,
						gitObject['branch'] = localBranchName,
						gitObject['revision_id'] = localRevisionID
					} else {
						let repoUrl = git.repositories[0].state.remotes[0].fetchUrl
						if (repoUrl) { 
							repoUrl = repoUrl.replace('git@', 'https://').replace('.git', '')
						}
						const localRepoURL = repoUrl
						const localBranchName = git.repositories[0].state.HEAD?.name
						const localRevisionID =  git.repositories[0].state.HEAD?.commit
						gitObject['git_repo_url'] =  localRepoURL,
						gitObject['branch'] = localBranchName,
						gitObject['revision_id'] = localRevisionID
					}
					if(gitObject['git_repo_url'] != codiffGlobals['git_repo_url'] || gitObject['branch'] != codiffGlobals['branch']) {
						vscode.window.showInformationMessage("repo or branch changed")
						setTimeout(() => {vscode.commands.executeCommand('codiff.start')}, 2000);
					} else if (gitObject['revision_id'] != codiffGlobals['revision_id']) {
						vscode.window.showInformationMessage("user has pushed some changes")
						socket.emit('push', {accessToken: Util.getAccessToken(), roomID: codiffGlobals['room_id'], gitObject: gitObject})
						axios.post(`${apiBaseUrl}/room/join?access_token=${Util.getAccessToken()}`, gitObject)
						.then(async function (response) {
							if(response.data.success) {
								console.log(response.data)
								socket.emit('join', {accessToken: Util.getAccessToken(), roomID: response.data.room_id})
								const codiffGlobals = {
									git_repo_url: gitObject['git_repo_url'],
									branch: gitObject['branch'],
									revision_id: gitObject['revision_id'],
									extension_status: "active",
									room_id: response.data.room_id,
									authenticated: true
								}
								await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
								const repoName = gitObject['git_repo_url']?.split('github.com/')[1]
								vscode.window.showInformationMessage(`Room ID for ${gitObject['branch']} branch of ${repoName} has been updated because the user pushed some changes.`)
								console.log("Updated codiff globals object:")
								console.log(Util.getcodiffGlobals())
								vscode.commands.executeCommand('codiff.refresh')
							} else {
								const codiffGlobals = {
									extension_status: "inactive",
									authenticated: true
								}
								await Util.context.globalState.update(codiffGlobalsObjectKey, codiffGlobals);
								console.log(response.data.error)
								vscode.window.showErrorMessage(`Conflict detection stopped. Error: ${response.data.error}`)
								console.log("Updated codiff globals object:")
								console.log(Util.getcodiffGlobals())
							}
						})
						.catch(function (error) {
							console.log(error);
						});				
					}
				} else {
					console.log("git not initialized")
				} 
			}
		}) 
	)

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(async document => {
			var codiffGlobals: {[key: string] : any} = Util.getcodiffGlobals()
			var extensionStatus = codiffGlobals['extension_status']
			if(extensionStatus == "active") {
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
					socket.emit('save', {relativePath, code: savedCode, roomID: codiffGlobals['room_id'], accessToken: Util.getAccessToken()})
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
