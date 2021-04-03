import * as vscode from 'vscode';
import { SidebarProvider } from "./SidebarProvider";
import { Util } from "./util";

export async function activate(context: vscode.ExtensionContext) {
	Util.context = context;
	
	if (!Util.isLoggedIn()) {
		console.log("it isnt logged in")
	} else {
		console.log("it is logged in")
		console.log(Util.getAccessToken())
	}
	
	console.log('codiff is now active!');
	const sidebarProvider = new SidebarProvider(context.extensionUri);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("codiff-sidebar", sidebarProvider)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('codiff.helloWorld', () => {
			vscode.window.showInformationMessage("Hello World!");
		})
	)
	
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(document => {
			const workspaceFolders = vscode.workspace.workspaceFolders
			if(workspaceFolders != undefined) {
				const rootPath = workspaceFolders[0].uri.path.substring(1).split('/').join("\\")
				const relativePath = document.fileName.split(rootPath)[1].substring(1)
				const code = document.getText()	
				console.log(relativePath)
				console.log(code)
			}
		})
	)

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			console.log(event);
		})
	)

}

export function deactivate() {}
