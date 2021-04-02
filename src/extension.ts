import * as vscode from 'vscode';
import { SidebarProvider } from "./SidebarProvider";

export function activate(context: vscode.ExtensionContext) {
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

}

export function deactivate() {}
