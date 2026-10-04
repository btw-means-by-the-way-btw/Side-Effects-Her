"use client";
import type {ComponentProps} from "react";
import {useT} from "./preferences-provider";
export function LocalizedInput(props:ComponentProps<"input">){const t=useT();return <input {...props} placeholder={props.placeholder?t(props.placeholder):undefined} aria-label={props["aria-label"]?t(props["aria-label"]):undefined}/>;}
export function LocalizedTextarea(props:ComponentProps<"textarea">){const t=useT();return <textarea {...props} placeholder={props.placeholder?t(props.placeholder):undefined}/>;}
export function LocalizedOption(props:ComponentProps<"option">){const t=useT();return <option {...props}>{typeof props.children==="string"?t(props.children):props.children}</option>;}
