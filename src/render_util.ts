import { MP_Button, MP_Div, MP_Header, MP_P, MP_Text } from "./frontend/menu_parts";
import { PackMetaData } from "./interface";

export async function loadModPackMetaPanel(meta:PackMetaData,panel?:HTMLElement|null){
    if(!panel) return;
    
    let root = new MP_Div({
        overrideDiv:panel
    });
    root.clearParts();

    let head = root.addPart(new MP_Div({className:"info-head"}));
    let body = root.addPart(new MP_Div({className:"info-body"}));
    let footer = root.addPart(new MP_Div({className:"info-footer"}));

    head.addParts(
        new MP_Header({
            textContent:meta.name
        }),
        new MP_Div({
            className:"info-details"
        }).addParts(
            new MP_Text({
                text:meta.version,
                className:"l-version"
            }),
            new MP_Text({
                text:meta.loader,
                className:"l-loader"
            })
        ),
    );

    body.addParts(
        new MP_P({
            text:meta.desc,
            className:"l-desc"
        })
    )

    footer.addParts(
        new MP_Button({
            label:"Add Mod Pack",
            className:"b-add-mod-pack",
            onclick:async e=>{
                let res = await window.gAPI.addInstance(meta);
                console.log("RES:",res);
                // window.close();
            }
        })
    )
}