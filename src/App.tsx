import {useEffect} from 'react'
import {Toolbar} from "./components/Toolbar";
import {Palette} from "./components/Palette";
import {Stage} from "./components/Stage";
import {Props} from "./components/Props";
import {DiagramTextEditor} from "./components/DiagramTextEditor";
import {Tour} from "./components/Tour";
import {ShowDiagram} from "./components/ShowDiagram";
import {PageTabs} from "./components/PageTabs";
import {Notify} from "./components/Notify";
import {ExportDialog} from "./components/ExportDialog";
import {ImportDialog} from "./components/ImportDialog";
import {PresentBar} from "./components/PresentBar";
import {CreditsDialog} from "./components/CreditsDialog";

export function App() {
    useEffect(() => {
        import('./engine/main.js')
    }, [])
    return <>
        <Toolbar/>
        <Palette/>
        <Stage/>
        <Props/>
        <DiagramTextEditor/>
        <Tour/>
        <ShowDiagram/>
        <PageTabs/>
        <Notify/>
        <ExportDialog/>
        <ImportDialog/>
        <PresentBar/>
        <CreditsDialog/>
    </>;
}