/** @babel */
import {CompositeDisposable} from 'atom';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import postcssSafeParser from 'postcss-safe-parser';
import postcssScss from 'postcss-scss';

const SUPPORTED_SCOPES = new Set([
	'source.css',
	'source.css.scss'
]);

async function init(editor, onSave) {
	const selectedText = onSave ? null : editor.getSelectedText();
	const text = selectedText || editor.getText();

	const options = {};

	if (editor.getGrammar().scopeName !== 'source.css') {
		options.syntax = postcssScss;
	} else {
		options.parser = postcssSafeParser
	}

	try {
		const result = await postcss(autoprefixer(atom.config.get('autoprefixer'))).process(text, options);

		result.warnings().forEach(x => {
			console.warn(x.toString());
			atom.notifications.addWarning('Autoprefixer', {
				detail: x.toString()
			});
		});

		const cursorPosition = editor.getCursorBufferPosition();
		const line = atom.views.getView(editor).getFirstVisibleScreenRow() +
			editor.getVerticalScrollMargin();

		if (selectedText) {
			editor.setTextInBufferRange(editor.getSelectedBufferRange(), result.css);
		} else {
			editor.getBuffer().setTextViaDiff(result.css);
		}

		editor.setCursorBufferPosition(cursorPosition);

		if (editor.getScreenLineCount() > line) {
			editor.scrollToScreenPosition([line, 0]);
		}
	} catch (error) {
		if (error.name === 'CssSyntaxError') {
			error.message += error.showSourceCode();
		}

		console.error(error);
		atom.notifications.addError('Autoprefixer', {detail: error.message});
	}
}

export const config = {
	browsers: {
		title: 'Supported Browsers',
		description: 'Using the [following syntax](https://github.com/ai/browserslist#queries).',
		type: 'array',
		default: autoprefixer.defaults,
		items: {
			type: 'string'
		}
	},
	cascade: {
		title: 'Cascade Prefixes',
		type: 'boolean',
		default: true
	},
	remove: {
		title: 'Remove Unneeded Prefixes',
		type: 'boolean',
		default: true
	},
	runOnSave: {
		title: 'Run on Save',
		type: 'boolean',
		default: false
	}
};

export function deactivate() {
	this.subscriptions.dispose();
}

export function activate() {
	this.subscriptions = new CompositeDisposable();

	this.subscriptions.add(atom.workspace.observeTextEditors(editor => {
		editor.getBuffer().onWillSave(async () => {
			const isCSS = SUPPORTED_SCOPES.has(editor.getGrammar().scopeName);

			if (isCSS && atom.config.get('autoprefixer.runOnSave')) {
				await init(editor, true);
			}
		});
	}));

	this.subscriptions.add(atom.commands.add('atom-workspace', 'autoprefixer', () => {
		const editor = atom.workspace.getActiveTextEditor();

		if (editor) {
			init(editor);
		}
	}));
}
