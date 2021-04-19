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

	interface Dic {
		[key: string]: [{}]
	}

	socket.on('save', async (message: { username: string; relativePath: string; code: string }) => {
		var saveObj: {[key: string] : any} = Util.getSaveObject()
		var keyWasFound = false
		Object.keys(saveObj).forEach((key: string) => {
			if(key == message.relativePath) {
				keyWasFound = true
				const fileSavesArray = saveObj[key]
				for(let i=0;i < fileSavesArray.length;i++) {
					if(fileSavesArray[i]["username"] == message.username) {
						fileSavesArray[i]["code"] = message.code
					} else {
						fileSavesArray.push({username: message.username, code: message.code})
					}
				}
			} 
		})
		if(!keyWasFound) {
			saveObj[message.relativePath] = [{username: message.username, code: message.code}]
		}
		await Util.context.globalState.update(saveObjectKey, saveObj);
		console.log('updated')
	})

	const sidebarProvider = new SidebarProvider(context.extensionUri);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("codiff-sidebar", sidebarProvider)
	);
	
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(async document => {
			const workspaceFolders = vscode.workspace.workspaceFolders
			if(workspaceFolders != undefined) {
				const rootPath = workspaceFolders[0].uri.path.substring(1).split('/').join("\\")
				const relativePath = document.fileName.split(rootPath)[1].substring(1)
				var saveObj: {[key: string] : any} = Util.getSaveObject()
				var code = document.getText()	
				var username = ""
				var ext = '.' + relativePath.split(".")[1]
				Object.keys(saveObj).forEach((key: string) => {
					if(key == relativePath) {
						const lengthOfFileSaves = saveObj[key].length
						code = saveObj[key][lengthOfFileSaves-1]["code"]
						username = saveObj[key][lengthOfFileSaves-1]["username"]
					}
				});
				const savedCode = document.getText()
				if(code != savedCode) {
					const writeData = Buffer.from(code, 'utf8')
					var tmp = require("tmp")
					var tmpFilePath = tmp.tmpNameSync({ postfix: ext });
					const sampleFileUri = vscode.Uri.file(tmpFilePath)
					vscode.workspace.fs.writeFile(sampleFileUri, writeData)
					const choice = await vscode.window.showInformationMessage(
						`Your code appears to have a conflict with ${username}'s recently saved version of this file. Would you like to view the conflicts?`,
						"Yes",
						"Cancel"
					);
					if (choice === "Yes") {
						vscode.commands.executeCommand("vscode.diff", sampleFileUri, document.uri, `Difference between ${username}'s and your version`)
					}
				} else {
					console.log("code was same")
				}
				socket.emit('save', {username: "sheldor1510", relativePath, savedCode})
				console.log('save event socket message sent')
			}
		})
	)

}

export function deactivate() {}
