import * as vscode from "vscode";
import { getNonce } from "./getNonce";
import { authenticate } from "./authenticate";
import { accessTokenKey } from "./constants";
import { Util } from "./util";

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "auth": {
          authenticate();
          break;
        }
        case "logout": {
          await Util.context.globalState.update(accessTokenKey, undefined);
          vscode.commands.executeCommand("workbench.action.reloadWindow");
          break;
        }
        case "startConflictDetection": {
          vscode.commands.executeCommand('codiff.start');
          break;
        }
        case "stopConflictDetection": {
          vscode.window.showInformationMessage("hello, this endpoint doesn't exist yet")
          break;
        }
      }
    });
  }

  public revive(panel: vscode.WebviewView) {
    this._view = panel;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "sidebar.js")
    );

    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "sidebar.css")
    );

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
        -->
        <meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${
          webview.cspSource
        }; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <script nonce="${nonce}">
          const tsvscode = acquireVsCodeApi();
        </script>
			</head>
      <body>
        <p hidden id="token">${Util.getAccessToken()}</p>
        <div id="initial">
            <h1>CoDiff</h1>
            <p>tagline for codiff</p>
            <br>
            <button id="authButton">Login with GitHub</button>
        </div>
        <div id="postAuth">
            <br><br>
            <img class="pfp" id="pfp" src=""/>
            <h1 id="usernameHeader"></h1>
            <div id="startButtonArea">
              <br><br>
              <button id="startButton">start conflict detection</button>
              <br><br>
            </div>
            <span id="more"></span>
            <button id="logoutButton">logout</button>
        </div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}