import * as _ from "lodash";
import * as path from "path";

import {
  commands,
  ExtensionContext,
  languages,
  ProgressLocation,
  window,
  workspace,
} from "vscode";
import { BlocCodeActionProvider } from "./code-actions";
import {
  convertToMultiBlocListener,
  convertToMultiBlocProvider,
  convertToMultiRepositoryProvider,
  newBloc,
  newCubit,
  wrapWithBlocBuilder,
  wrapWithBlocConsumer,
  wrapWithBlocListener,
  wrapWithBlocProvider,
  wrapWithBlocSelector,
  wrapWithRepositoryProvider,
} from "./commands";
import { analyzeDependencies, setShowContextMenu } from "./utils";

const DART_MODE = { language: "dart", scheme: "file" };

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

async function initializeLanguageClient(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [DART_MODE],
    synchronize: {
      // Notify the server about file changes to '.dart files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.dart"),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "blocAnalysisLSP",
    "Bloc Analysis Server",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  return client.start();
}

export function activate(_context: ExtensionContext) {
  window.withProgress(
    {
      location: ProgressLocation.Window,
      title: "Bloc Analysis Server",
    },
    async (_) => {
      try {
        await initializeLanguageClient(_context);
        window.setStatusBarMessage("✓ Bloc Analysis Server", 3000);
      } catch (err) {
        window.showErrorMessage(`${err}`);
      }
    }
  );

  if (workspace.getConfiguration("bloc").get<boolean>("checkForUpdates")) {
    analyzeDependencies();
  }

  setShowContextMenu();

  _context.subscriptions.push(
    window.onDidChangeActiveTextEditor((_) => setShowContextMenu()),
    workspace.onDidChangeWorkspaceFolders((_) => setShowContextMenu()),
    workspace.onDidChangeTextDocument(async function (event) {
      if (event.document.uri.fsPath.endsWith("pubspec.yaml")) {
        setShowContextMenu(event.document.uri);
      }
    }),
    commands.registerCommand("extension.new-bloc", newBloc),
    commands.registerCommand("extension.new-cubit", newCubit),
    commands.registerCommand(
      "extension.convert-multibloclistener",
      convertToMultiBlocListener
    ),
    commands.registerCommand(
      "extension.convert-multiblocprovider",
      convertToMultiBlocProvider
    ),
    commands.registerCommand(
      "extension.convert-multirepositoryprovider",
      convertToMultiRepositoryProvider
    ),
    commands.registerCommand("extension.wrap-blocbuilder", wrapWithBlocBuilder),
    commands.registerCommand(
      "extension.wrap-blocselector",
      wrapWithBlocSelector
    ),
    commands.registerCommand(
      "extension.wrap-bloclistener",
      wrapWithBlocListener
    ),
    commands.registerCommand(
      "extension.wrap-blocconsumer",
      wrapWithBlocConsumer
    ),
    commands.registerCommand(
      "extension.wrap-blocprovider",
      wrapWithBlocProvider
    ),
    commands.registerCommand(
      "extension.wrap-repositoryprovider",
      wrapWithRepositoryProvider
    ),
    languages.registerCodeActionsProvider(
      DART_MODE,
      new BlocCodeActionProvider()
    )
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined;
  return client.stop();
}
