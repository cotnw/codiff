import * as path from "path";
import * as vscode from "vscode";
import { accessTokenKey, saveObjectKey, codiffGlobalsObjectKey } from "./constants";
import { API, GitExtension } from './git';

let git: API | null | undefined;

export class Util {
  static context: vscode.ExtensionContext;

  static getAccessToken() {
    return this.context.globalState.get<string>(accessTokenKey) || "";
  }

  static getSaveObject() {
    return this.context.globalState.get<object>(saveObjectKey) || {};
  }

  static getcodiffGlobals() {
    return this.context.globalState.get<object>(codiffGlobalsObjectKey) || {};
  }

  static isLoggedIn() {
    return (
      !!this.context.globalState.get(accessTokenKey) 
    );
  }

  static getWorkspacePath() {
    const folders = vscode.workspace.workspaceFolders;
    return folders ? folders![0].uri.fsPath : undefined;
  }

  static getResource(rel: string) {
    return path
      .resolve(this.context.extensionPath, rel.replace(/\//g, path.sep))
      .replace(/\\/g, "/");
  }
}

// https://github.com/iCrawl/discord-vscode/blob/7cefeb2af85929bbd48f8a7326cf89e98df4b048/src/util.ts#L67

export async function getGit() {
	if (git || git === null) {
		return git;
	}

	try {
		const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')
		if (!gitExtension?.isActive) {
			await gitExtension?.activate()
		}
		git = gitExtension?.exports.getAPI(1)
	} catch (error) {
		git = null
	}

	return git;
}