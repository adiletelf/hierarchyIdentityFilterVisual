/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsModel = formattingSettings.Model;

class InformationCardSettings extends FormattingSettingsCard {
    descriptionText = new formattingSettings.ReadOnlyText({
        name: 'descriptionText',
        displayName: 'Description',
        value: 'This is a test visual for hierarchy identity filters.',
    });

    name = "information";
    displayName = "Information";
    slices = [this.descriptionText];
}

class UnselectAllCardSettings extends FormattingSettingsCard {
    unselectAllByDefault = new formattingSettings.ToggleSwitch({
        name: 'unselectAllByDefault',
        displayName: 'Unselect all by default',
        value: false
    });

    unselectString = new formattingSettings.TextInput({
        name: 'unselectString',
        displayName: 'Default string',
        value: 'No Data',
        placeholder: ''
    });

    // TODO: figure out what this does.
    visible = false;
    name: string = "unselectAll";
    displayName: string = "Unselect all";
    slices: formattingSettings.Slice[] = [this.unselectAllByDefault, this.unselectString];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    information = new InformationCardSettings();
    unselectAll = new UnselectAllCardSettings();
    cards = [this.information];
}
