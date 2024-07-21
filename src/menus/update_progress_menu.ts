import { UpdateProgress_InitData } from "src/interface";
import { makeDivPart, MP_Grid, MP_Header, MP_Progress, MP_Section } from "../menu_parts";
import "../render_lib";
import "../render_util";
import { InitData } from "../render_util";

let initData = new InitData<UpdateProgress_InitData>(init);
const root = makeDivPart("body");
const main = root.addPart(new MP_Grid({
    className:"root",
    template_rows:"auto 1fr"
}));

const progress = new MP_Progress({});

window.gAPI.onUpdateProgress((id:string,i:number,total:number,item:string,extra:any)=>{
    if(id == "main"){
        progress.updateProgress(i,total,item,extra);
    }
});

async function init(){
    if(!root.e) return;
    
    const header = new MP_Section().addParts(
        new MP_Header({
            textContent:"Update Progress"
        })
    ).addTo(main);
    const body = new MP_Section().addTo(main);
    // 
    
    progress.addTo(body);
}