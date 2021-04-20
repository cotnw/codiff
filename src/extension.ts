import * as vscode from 'vscode';
import { SidebarProvider } from "./SidebarProvider";
import { Util } from "./util";
import { apiBaseUrl, saveObjectKey } from './constants';
const io = require("socket.io-client");

export async function activate(context: vscode.ExtensionContext) {
	Util.context = context;
	
	if (!Util.isLoggedIn()) {
		console.log("it isnt logged in")
	} else {
		console.log("it is logged in")
		console.log(Util.getAccessToken())
	}
	
	console.log('codiff is now active!');
	const socket = io.connect(apiBaseUrl);
	console.log('socket initialized');

	console.log(Util.getSaveObject())

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

	const sidebarProvider = new SidebarProvider(context.extensionUri);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("codiff-sidebar", sidebarProvider)
	);
	
	context.subscriptions.push(
		vscode.commands.registerCommand('codiff.clearGlobalStorage', async () => {
			await Util.context.globalState.update(saveObjectKey, undefined).then(() => console.log(Util.getSaveObject()));
		})
	)
	
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(async document => {
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
		})
	)

}

export function deactivate() {}
