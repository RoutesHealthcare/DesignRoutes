/* Entry point. Each module only declares things when it is imported; init() wires it to the page.
   The init() calls run in the same order as the original single script, which some of them rely on
   (for example, selection state must exist before the pointer handlers and the first render). */
import {init as initCore} from './core';
import {init as initSelection} from './selection';
import {init as initTextEditor} from './text-editor';
import {init as initPointer} from './pointer';
import {init as initProperties} from './properties';
import {init as initFormatsExport} from './formats/export';
import {init as initFormatsImport} from './formats/import';
import {init as initDialogs} from './dialogs';
import {init as initFlowModel} from './flow/model';
import {init as initFlowLanguage} from './flow/language';
import {init as initConnectionProps} from './connection-props';
import {init as initTextPane, TP, setPane} from './text-pane';
import {init as initToolbar} from './hot-keys';
import {init as initTutorial, maybeStartTour} from './tutorial';
import {init as initIntellisense} from './intellisense';
import {newDoc} from './document';

for (const init of [initCore, initSelection, initTextEditor, initPointer, initProperties, initFormatsExport, initFormatsImport, initDialogs, initFlowModel, initFlowLanguage, initConnectionProps, initTextPane, initToolbar, initTutorial, initIntellisense]) init();

newDoc();
setPane(TP.open, TP.pinned);
maybeStartTour();
document.documentElement.dataset.ready = 'true';
