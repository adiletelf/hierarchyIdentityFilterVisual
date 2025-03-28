/* eslint-disable powerbi-visuals/no-http-string */
/* eslint-disable powerbi-visuals/no-inner-outer-html */
/*
*  Power BI Visual CLI
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

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { IHierarchyIdentityFilterTarget, IHierarchyIdentityFilterNode, HierarchyFilterNodeOperators, FilterType, HierarchyIdentityFilter, IHierarchyIdentityFilter } from "powerbi-models"
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionIdBuilder = powerbi.visuals.ISelectionIdBuilder;
import DataView = powerbi.DataView;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import ICustomVisualsOpaqueUtils = powerbi.extensibility.ICustomVisualsOpaqueUtils;
import CustomVisualOpaqueIdentity = powerbi.visuals.CustomVisualOpaqueIdentity;


import { VisualFormattingSettingsModel } from "./settings";

// powerbi-models types
// ==============================================================================
// export declare enum FilterType {
//     Advanced = 0,
//     Basic = 1,
//     Unknown = 2,
//     IncludeExclude = 3,
//     RelativeDate = 4,
//     TopN = 5,
//     Tuple = 6,
//     RelativeTime = 7,
//     Identity = 8,
//     Hierarchy = 9,
//     HierarchyIdentity = 10 // <------ NEW ------>
// }

// export interface IFilter {
//     $schema: string;
//     filterType: FilterType;
// }

// export interface IQueryNameTarget {
//     queryName: string;
// }

// export declare type IHierarchyIdentityFilterTarget = IQueryNameTarget[];

// /**
// * Selected – value is explicitly selected.
// * NotSelected – value is explicitly not selected.
// * Inherited – value selection is according to the parent value in the hierarchy, or default if it's the root value.
// */
// export declare type HierarchyFilterNodeOperators = "Selected" | "NotSelected" | "Inherited";

// export interface IHierarchyIdentityFilterNode<IdentityType> {
//     /* IdentityType should be CustomVisualOpaqueIdentity */
//     identity: IdentityType;
//     children?: IHierarchyIdentityFilterNode<IdentityType>[];
//     operator: HierarchyFilterNodeOperators;
// }

// export interface IHierarchyIdentityFilter<IdentityType> extends IFilter {
//     target: IHierarchyIdentityFilterTarget;
//     /* the selected and unselected items in a hierarchy tree where each IHierarchyIdentityFilterNode represents a single value selection */
//     hierarchyData: IHierarchyIdentityFilterNode<IdentityType>[];
// }

// ==============================================================================


interface MatrixDataPoint {
    selectionId: ISelectionId;
    children: MatrixDataPoint[];
    element: HTMLElement;
    selected: boolean;
    value: string[];
    isSubTotal: boolean;
    path: DataViewMatrixNode[];
    level: number;
}

interface MatrixData {
    root: MatrixDataPoint;
}

const dataRoles = {
    Rows: 'Rows',
    Value: 'Value'
}

type SelectionState = 'Selected' | 'Unselected' | 'Partial' | 'Default';
type SelectionStateColors = Record<SelectionState, string>;

const selectionsColors: SelectionStateColors = {
    Selected: 'green',
    Unselected: 'white',
    Partial: 'lightGreen',
    Default: 'white'
}

type CompareIdentitiesFunc = (id1: CustomVisualOpaqueIdentity, id2: CustomVisualOpaqueIdentity) => boolean;

export class Visual implements IVisual {
    private target: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private clearSelectionsBtn: HTMLButtonElement;
    private opaqueUtils: ICustomVisualsOpaqueUtils;

    private content: HTMLElement;
    private data: MatrixData;

    private applyFilterCheckBox: HTMLInputElement;

    private filterData: IHierarchyIdentityFilterNode<CustomVisualOpaqueIdentity>[];
    private filterTarget: IHierarchyIdentityFilterTarget;

    private isUnselectAllByDefault: boolean = false;
    private columns: powerbi.DataViewMetadataColumn[];
    private dataView: powerbi.DataView;

    private defaultFilterString = 'No Data';

    constructor(options: VisualConstructorOptions) {
        console.log('Visual constructor', options);
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;
        this.target.style.overflow = 'auto';
        this.host = options.host;
        this.opaqueUtils = options.host.createOpaqueUtils();
        this.selectionManager = options.host.createSelectionManager();
        this.data = { root: undefined };

        if (document) {
            const headerContainer = document.createElement("div");
            headerContainer.className = 'header-container';
            this.target.appendChild(headerContainer);

            this.applyFilterCheckBox = document.createElement("input");
            this.applyFilterCheckBox.setAttribute("type", "checkbox");
            this.applyFilterCheckBox.setAttribute("checked", "true")
            this.applyFilterCheckBox.id = "applyFilterCheckBox";

            const label = document.createElement("label");
            label.setAttribute("for", "applyFilterCheckBox");
            label.textContent = "Unselect all by default";

            // const wrapper = document.createElement("div");
            // wrapper.appendChild(this.applyFilterCheckBox);
            // wrapper.appendChild(label);
            // headerContainer.appendChild(wrapper);

            this.applyFilterCheckBox.addEventListener('click', () => this.persistProperty());

            this.clearSelectionsBtn = document.createElement('button');
            this.clearSelectionsBtn.className = 'clear-button';
            this.clearSelectionsBtn.textContent = 'Clear Selections';
            headerContainer.appendChild(this.clearSelectionsBtn);

            this.clearSelectionsBtn.addEventListener('click', () => this.clearSelections());

            this.content = document.createElement("table");
            this.target.appendChild(this.content);
        }
    }

    public update(options: VisualUpdateOptions) {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);

        console.log('Visual update', options);
        if (!options) {
            return;
        }
        if (options.type & powerbi.VisualUpdateType.Data) {
            if (!options.dataViews
                || !options.dataViews[0]
                || !options.dataViews[0].matrix
                || !options.dataViews[0].matrix.rows
                || !options.dataViews[0].matrix.rows.root
                || !options.dataViews[0].matrix.rows.root.children
                || !options.dataViews[0].matrix.rows.root.children.length
                || !options.dataViews[0].matrix.columns
                || !options.dataViews[0].matrix.columns.root
            ) {
                this.content.innerHTML = "";
                return;
            }

        

            this.dataView = options.dataViews[0];

            this.columns = options.dataViews[0].metadata.columns.filter(col => !col.isMeasure).sort((col1, col2) => col1.index - col2.index);
            const newIsUnselectAllByDefault = false && this.formattingSettings.unselectAll.unselectAllByDefault.value;
            const defaultNotFilterString = this.formattingSettings.unselectAll.unselectString.value;
            this.defaultFilterString = defaultNotFilterString || this.defaultFilterString;


            let shouldApplyDefaultFilter = false;
            if (options.jsonFilters && options.jsonFilters[0] && (options.jsonFilters[0] as any).filterType === 1) {
                this.filterData = [];
                this.filterTarget = [];
            } else {
                this.filterData = options.jsonFilters && options.jsonFilters[0] && (options.jsonFilters[0] as any).hierarchyData;
                this.filterTarget = options.jsonFilters && options.jsonFilters[0] && (options.jsonFilters[0] as any).target;
                // we apply the default filter everytime the filter has been reset in the Unselect mode
                if (newIsUnselectAllByDefault && (!this.filterData || !this.filterData.length)) {
                    shouldApplyDefaultFilter = true;
                }
            }


            let content = document.createElement("table");
            const rowsRoot = options.dataViews[0].matrix.rows.root;
            const rowsLevels = options.dataViews[0].matrix.rows.levels;

            this.drawContentHeader(content, rowsLevels, options.dataViews[0].matrix.columns.levels);
            this.data.root = this.drawContent(this.host, rowsRoot, rowsLevels, content, []);

            this.target.removeChild(this.content);
            this.content = content;
            this.target.appendChild(this.content);

            // clear the filter on new mode
            if ((this.isUnselectAllByDefault != newIsUnselectAllByDefault) || shouldApplyDefaultFilter) {
                this.isUnselectAllByDefault = newIsUnselectAllByDefault;
                this.clearSelections();
            } else {
                this.renderSelectionFromFilter();
            }

            //this.renderSelection();
        }
    }

    private drawContentHeader(content: HTMLTableElement, rowLevels: powerbi.DataViewHierarchyLevel[], columnLevels: powerbi.DataViewHierarchyLevel[]): void {
        const headerRow = content.createTHead().insertRow(0);

        const displayNames = rowLevels.map(level => level.sources.map(source => source.displayName)).flat();
        headerRow.insertCell(0).textContent = displayNames.join(' | ');


        const columnNames = columnLevels.map(level => level.sources.map(source => source.displayName)).flat();
        columnNames.forEach((name, index) => {
            headerRow.insertCell(index + 1).textContent = name;
        });
    }

    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property. 
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private persistProperty(): void {
        console.log(`persistProperty ${this.applyFilterCheckBox.checked}`)
        let property = {
            merge: [{
                objectName: "unselectAll",
                properties: {
                    unselectAllByDefault: this.applyFilterCheckBox.checked
                },
                selector: null
            }]
        };
        this.host.persistProperties(property);
    }


    private drawContent(visualHost: IVisualHost, node: powerbi.DataViewMatrixNode, levels: powerbi.DataViewHierarchyLevel[], content: HTMLElement, parentNodes: powerbi.DataViewMatrixNode[]): MatrixDataPoint {
        let value;
        let identity: ISelectionId;
        if (node.identity) {
            let identityBuilder: ISelectionIdBuilder = visualHost.createSelectionIdBuilder();
            parentNodes.push(node);
            value = [];
            for (let i = 0; i < parentNodes.length; i++) {
                identityBuilder = identityBuilder.withMatrixNode(parentNodes[i], levels);
                if (parentNodes[i].value != null) {
                    value.push(parentNodes[i].value.toString());
                }
            }

            identity = identityBuilder.createSelectionId();
        }

        const level = parentNodes.length - 1;
        const nodeDataPoint: MatrixDataPoint = {
            selectionId: identity,
            children: [],
            element: null,
            selected: false,
            value: value,
            isSubTotal: false,
            path: parentNodes,
            level,
        }
        if (!(typeof node.level === 'undefined' || node.level == null) && !(node.isSubtotal && node.level != 0)) {
            const tr_em: HTMLElement = document.createElement("tr");

            let leftpadding = (5 + node.level * 25).toString();

            const td_em: HTMLElement = document.createElement("td");
            const divTd: HTMLElement = document.createElement('div');
            divTd.style.paddingLeft = leftpadding + 'px';

            const divTdData: HTMLElement = document.createElement('div');
            divTdData.style.display = "inline-block"
            nodeDataPoint.isSubTotal = node.isSubtotal;

            divTdData.innerHTML = node.isSubtotal
                ? "Totals"
                : node.value === ''
                    ? node.value.toString()
                    : "No Data";

            if (!nodeDataPoint.isSubTotal) {
                divTdData.addEventListener('contextmenu', (ev) => this.showContextMenu(ev, identity, dataRoles.Rows));
                divTdData.addEventListener('click', (ev) => {
                    this.handleSelection(nodeDataPoint.path, nodeDataPoint.level, value, (ev.ctrlKey || ev.metaKey || ev.shiftKey));
                })
            } else {
                //clear selectionId if subtotals
                nodeDataPoint.selectionId = null;
            }


            // Assign div to data point
            nodeDataPoint.element = divTdData

            if (node.isCollapsed != null) {
                const arrow_em = this.createExpandCollapseElement(node.isCollapsed);
                arrow_em.addEventListener('click', (ev) => this.toggleExpandCollapse(ev, identity));
                divTd.appendChild(arrow_em);
            }

            divTd.appendChild(divTdData);
            td_em.appendChild(divTd);
            tr_em.appendChild(td_em);
            if (node.values) {
                for (let key in node.values) {
                    const td_value_em: HTMLElement = document.createElement("td");
                    td_value_em.style.textAlign = 'right';
                    td_value_em.style.paddingLeft = '50px';

                    const value = node.values[key].value;
                    let valueText: string;
                    if (value == null) {
                        valueText = "No Data";
                    } else if (typeof value === 'number') {
                        valueText = value.toLocaleString();
                    } else if (typeof value === 'string') {
                        valueText = value;
                    } else {
                        valueText = value.toString();
                    }
                    td_value_em.innerHTML = valueText;

                    tr_em.appendChild(td_value_em);
                }
            } else if (node.children && node.children[node.children.length - 1].isSubtotal) {
                for (let key in node.children[node.children.length - 1].values) {
                    const td_value_em: HTMLElement = document.createElement("td");
                    td_value_em.style.textAlign = 'right';
                    td_value_em.style.paddingLeft = '50px';

                    const value = node.children[node.children.length - 1].values[key].value;
                    let valueText: string;
                    if (value == null) {
                        valueText = "No Data";
                    } else if (typeof value === 'number') {
                        valueText = value.toLocaleString();
                    } else if (typeof value === 'string') {
                        valueText = value;
                    } else {
                        valueText = value.toString();
                    }

                    td_value_em.innerHTML = valueText;
                    tr_em.appendChild(td_value_em);
                }
            }
            content.appendChild(tr_em);
        }
        if (node.children) {
            node.children.forEach((child) => {
                const childDataPoint = this.drawContent(visualHost, child, levels, content, [...parentNodes]);
                nodeDataPoint.children.push(childDataPoint);
            })
        }
        return nodeDataPoint;
    }

    private createExpandCollapseElement(isCollapsed: boolean): HTMLElement {
        const arrowContainer = document.createElement('div');
        arrowContainer.className = 'arrow-container';
        arrowContainer.id = 'arrowContainer';

        const arrow = document.createElement('div');
        arrow.className = isCollapsed ? 'arrow down' : 'arrow up';
        arrow.id = 'arrow';

        arrowContainer.appendChild(arrow);
        return arrowContainer;
    }


    private handleSelection(path: DataViewMatrixNode[], level: number, value: string[], multiSelect: boolean, hierarchySelect: boolean = true): void {
        const filter = this.handleJSONFilter(path, level, multiSelect);
        console.log('Visual applyJsonFilter', JSON.parse(JSON.stringify(filter || 'undefined')));

        this.renderSelectionFromFilter();
        this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
    }

    private clearSelections(): void {
        const filter = this.handleJSONFilter(undefined, undefined, undefined, true /* clear */);
        this.renderSelectionFromFilter();

        this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
    }

    private getDefaultBasicFilter(): powerbi.IFilter {
        const index = this.columns[0].queryName.lastIndexOf('.');
        const table = this.columns[0].queryName.slice(0, index);
        const column = this.columns[0].queryName.slice(index + 1);
        const filter = {
            $schema: "http://powerbi.com/product/schema#basic",
            filterType: 1,
            operator: 'In',
            target: { table, column },
            values: [this.defaultFilterString]
        };
        return filter
    }

    private handleJSONFilter(path?: DataViewMatrixNode[], level?: number, multiSelect: boolean = false, clear: boolean = false): powerbi.IFilter {
        if (clear) {
            //console.log('------- before -------', JSON.parse(JSON.stringify(this.filterData || 'undefined')));
            // TODO: fix the multiSelect
            if (this.isUnselectAllByDefault) {
                const filter = this.getDefaultBasicFilter();
                this.filterData = []
                //console.log('------- after Tuple-------', JSON.parse(JSON.stringify(this.filterData || 'undefined')), JSON.parse(JSON.stringify(filter)));
                return filter;
            } else {
                this.filterData = [];
                this.filterTarget = [];
            }

            const filter2 = new HierarchyIdentityFilter(this.filterTarget, this.filterData).toJSON();
            const filter: IHierarchyIdentityFilter<CustomVisualOpaqueIdentity> = {
                $schema: "https://powerbi.com/product/schema#hierarchyIdentity",
                filterType: FilterType.HierarchyIdentity,
                target: this.filterTarget,
                hierarchyData: this.filterData
            };
            //console.log('------- after -------', JSON.parse(JSON.stringify(filter || 'undefined')));

            return filter2;
        } else {
            //console.log('------- before -------', JSON.parse(JSON.stringify(this.filterData || 'undefined')));
            // TODO: fix the multiSelect
            if (multiSelect) {
                this.filterData = updateFilterTreeOnNodeSelection(path && path.map(node => node.identity), this.filterData, this.opaqueUtils.compareCustomVisualOpaqueIdentities)
            } else {
                this.filterData = updateSelectionInTree(path, this.filterData, this.opaqueUtils.compareCustomVisualOpaqueIdentities);
            }
            this.filterTarget = [];
            if (this.isUnselectAllByDefault) {
                if (!this.filterData || !this.filterData.length) {
                    const filter = this.getDefaultBasicFilter();
                    this.filterData = []
                    //console.log('------- after Tuple-------', JSON.parse(JSON.stringify(this.filterData || 'undefined')), JSON.parse(JSON.stringify(filter)));
                    return filter;
                }
            }

            const filter2 = new HierarchyIdentityFilter(this.filterTarget, this.filterData);
            const filter2Json = filter2.toJSON();
            const filter = {
                $schema: "https://powerbi.com/product/schema#hierarchyIdentity",
                filterType: 10,
                target: this.filterTarget,
                hierarchyData: this.filterData
            };
            //console.log('------- after -------', JSON.parse(JSON.stringify(filter || 'undefined')));

            return filter2;
        }
    }

    private toggleExpandCollapse(ev: MouseEvent, selectionId: ISelectionId) {
        //console.log('key:', selectionId.getKey());
        this.selectionManager.toggleExpandCollapse(selectionId).then(
            (result: object) => {
                console.log('toggleExpandCollapse have sent');

            },
            (err) => {
                console.error('toggleExpandColllapse failed', err);
            }
        );
        ev.preventDefault();
    }

    private showContextMenu(ev: MouseEvent, selectionId: ISelectionId, dataRole?: string) {
        this.selectionManager.showContextMenu(selectionId, { x: ev.clientX, y: ev.clientY }, dataRole);
        ev.preventDefault();
    }

    private renderSelectionFromFilter(): void {
        if (this.data.root) {
            this.addColorFromFilter(this.data.root);
        }
    }

    private addColorFromFilter(dataPoint: MatrixDataPoint): void {
        if (dataPoint.path.length && dataPoint.element && dataPoint.element.style) {
            dataPoint.element.style.backgroundColor = selectionsColors[this.getDataPointSlectionState(dataPoint, this.opaqueUtils.compareCustomVisualOpaqueIdentities)];
        }
        dataPoint.children.forEach((child) => this.addColorFromFilter(child));
    }

    // TODO: optimize
    private getDataPointSlectionState(dataPoint: MatrixDataPoint, compareIdentites: CompareIdentitiesFunc): SelectionState {
        // init to default value
        let selectionState: SelectionState = 'Default';
        let isPartial = false;
        let isFirstParentSelected = undefined;

        if (dataPoint.selectionId && this.filterData) {
            const identities: CustomVisualOpaqueIdentity[] = dataPoint.path.map(node => node.identity);
            let currentNodesLevel = this.filterData || [];
            let found = false;
            for (let level = 0; level < identities.length; level++) {
                for (const node of currentNodesLevel) {
                    if (compareIdentites(node.identity, identities[level])) {
                        found = level === identities.length - 1;
                        isPartial = !!(node.children && node.children.length);
                        if (node.operator !== 'Inherited') {
                            isFirstParentSelected = node.operator === 'Selected';
                        }
                        currentNodesLevel = node.children || [];
                        break;
                    }
                }
            }
            if (found && isPartial) {
                selectionState = 'Partial';
            } else if (isFirstParentSelected !== undefined) {
                selectionState = isFirstParentSelected ? 'Selected' : 'Unselected';
            }
        }

        return selectionState;
    }
}


//type CompateIdentitiesFunc = (id1: CustomVisualOpaqueIdentity, id2: CustomVisualOpaqueIdentity) => boolean;

// We should keep the tree valid after each insertion
// complexity: time - O(h*children) , memory - O(h)
// multiSelect

/**
 * Updates the filter tree following a new node selection.  
 * Prunes irrelevant branches after node insertion/removal if necessary.
 * @param path Identites path to the selected node.
 * @param treeNodes Array of IHierarchyIdentityFilterNode representing a valid filter tree.
 * @param compareIdentities Compare function for CustomVisualOpaqueIdentity to determine equality. Pass the ICustomVisualsOpaqueUtils.compareCustomVisualOpaqueIdentities function.
 * @returns A valid filter tree after the update 
 */
function updateFilterTreeOnNodeSelection(
    path: CustomVisualOpaqueIdentity[],
    treeNodes: IHierarchyIdentityFilterNode<CustomVisualOpaqueIdentity>[],
    compareIdentities: CompareIdentitiesFunc
): IHierarchyIdentityFilterNode<CustomVisualOpaqueIdentity>[] {
    if (!path) return treeNodes;

    const root: IHierarchyIdentityFilterNode<CustomVisualOpaqueIdentity> = {
        identity: null,
        children: treeNodes || [],
        operator: 'Inherited',
    };
    let currentNodesLevel = root.children;
    let isClosestSelectedParentSelected  = root.operator === 'Selected';
    let parents: { node: IHierarchyIdentityFilterNode<CustomVisualOpaqueIdentity>, index: number }[] = [{ node: root, index: -1 }];
    let shouldFixTree = false;

    path.forEach((identity, level) => {
        const index = currentNodesLevel.findIndex((node) => compareIdentities(node.identity, identity));
        const isLastNodeInPath = level === path.length - 1
        if (index === -1) {
            const newNode: IHierarchyIdentityFilterNode<CustomVisualOpaqueIdentity> = {
                identity,
                children: [],
                operator: isLastNodeInPath ? (isClosestSelectedParentSelected  ? 'NotSelected' : 'Selected') : 'Inherited',
            };
            currentNodesLevel.push(newNode);
            currentNodesLevel = newNode.children;
            if (newNode.operator !== 'Inherited') {
                isClosestSelectedParentSelected  = newNode.operator === 'Selected';
            }
        } else {
            const currentNode = currentNodesLevel[index];
            if (isLastNodeInPath) {
                const partial = currentNode.children && currentNode.children.length;
                if (partial) {
                    /**
                     * The selected node has subtree. 
                     * Therefore, selecting this node should lead to one of the following scenarios:
                     * 1. The node should have Selected operator and its subtree should be pruned.
                     * 2. The node and its subtree should be pruned form the tree and the tree shoud be fixed.
                     */

                    // The subtree should be always pruned.
                    currentNode.children = [];
                    if (currentNode.operator === 'NotSelected' || (currentNode.operator === 'Inherited' && isClosestSelectedParentSelected )) {
                        /**
                         * 1. The selected node has NotSelected operator.
                         * 2. The selected node has Inherited operator, and its parent has Slected operator.
                         * In both cases the node should be pruned from the tree and the tree shoud be fixed.
                         */
                        currentNode.operator = 'Inherited'; // to ensure it  will be pruned
                        parents.push({ node: currentNode, index });
                        shouldFixTree = true;
                    } else {
                        /**
                         * 1. The selected node has Selected operator.
                         * 2. The selected node has Inherited operator, but its parent doesn't have Selected operator.
                         * In both cases the node should stay with Slected operator pruned from the tree and the tree shoud be fixed.
                         * Note that, node with Selected oprator and parent with Selector operator is not valid state. 
                         */
                        currentNode.operator = 'Selected';
                    }
                } else {
                    // Leaf node. The node should be pruned from the tree and the tree shoud be fixed.
                    currentNode.operator = 'Inherited'; // to ensure it will be pruned
                    parents.push({ node: currentNode, index });
                    shouldFixTree = true;
                }
            } else {
                // If it's not the last noded in path we just continue traversing the tree
                currentNode.children = currentNode.children || [];
                currentNodesLevel = currentNode.children
                if (currentNode.operator !== 'Inherited') {
                    isClosestSelectedParentSelected  = currentNode.operator === 'Selected';
                    // We only care about the closet parent with Selected/NotSelected operator and its children
                    parents = [];
                }
                parents.push({ node: currentNode, index });
            }
        }
    });

    // Prune brnaches with Inherited leaf
    if (shouldFixTree) {
        for (let i = parents.length - 1; i >= 1; i--) {
            // Normalize to empty array
            parents[i].node.children = parents[i].node.children || [];
            if (!parents[i].node.children.length && (parents[i].node.operator === 'Inherited')) {
                // Remove the node from its parent children array
                removeElement(parents[i - 1].node.children, parents[i].index);
            } else {
                // Node has children or Selected/NotSelected operator
                break;
            }
        }
    }

    return root.children;
}

/**
 * Removes an element from the array without preserving order.
 * @param {any[]} arr - The array from which to remove the element.
 * @param {number} index - The index of the element to be removed.
 */
function removeElement(arr: any[], index: number): void {
    if (!arr || !arr.length || index < 0 || index >= arr.length) return;
    arr[index] = arr[arr.length - 1];
    arr.pop();
}

// if (currentNode.operator !== 'Inherited') {
//     if (currentNode.operator === 'Selected') {
//         // When selecting node with Selected operator, we do not need to change its operator but only clear its children
//         currentNode.children = [];
//     } else {
//         // When selecting node with NotSelected operator, we should remove the node and fix the tree.
//         currentNode.operator = 'Inherited'; // to ensure it  will be pruned
//         parents.push({ node: currentNode, index });
//         shouldFixTree = true;
//     }
// } else {
//     // The selected node has an Inherited operator, means it was a parent of another Selected/NotSelected node.                        
//     if (isCheckedParentSelected) {
//         // Node has children therefore should be Selected, but its parent is also Selected, therefore we should remove this node and fix the tree.
//         currentNode.operator = 'Inherited'; // to ensure it  will be pruned
//         parents.push({ node: currentNode, index });
//         shouldFixTree = true;
//     } else {
//         // Node has children therefore should be Selected, we should clear its children.
//         currentNode.operator = 'Selected';
//         currentNode.children = [];
//     }
// }

// should be in PBI to hide the CustomVisualOpaqueIdentity impl
// We should keep the tree valid after each insertion
// complexity: time - O(h*children) , memory - O(h)
// multiSelect
function updateSelectionInTree(nodePath: DataViewMatrixNode[], treeNodes: IHierarchyIdentityFilterNode<CustomVisualOpaqueIdentity>[], compareIdentites: CompareIdentitiesFunc): IHierarchyIdentityFilterNode<CustomVisualOpaqueIdentity>[] {
    if (!nodePath) return treeNodes;

    let newTreeNodes: IHierarchyIdentityFilterNode<CustomVisualOpaqueIdentity>[] = [];

    const clearTree = shouldClearTree(nodePath, treeNodes, compareIdentites);

    // Clear the tree only if the checked node is the only checked node in the tree.
    // Otherwise build a new tree based on the noded path
    if (clearTree) {
        newTreeNodes = [];
    } else {
        newTreeNodes = updateFilterTreeOnNodeSelection(nodePath.map(node => node.identity), [], compareIdentites);
    }

    return newTreeNodes;
}

// should be in PBI to hide the CustomVisualOpaqueIdentity impl
// We should keep the tree valid after each insertion
// complexity: time - O(h*children) , memory - O(h)
// multiSelect
function shouldClearTree(nodePath: DataViewMatrixNode[], treeNodes: IHierarchyIdentityFilterNode<CustomVisualOpaqueIdentity>[], compareIdentites: CompareIdentitiesFunc): boolean {
    if (!nodePath || !treeNodes || !treeNodes.length) {
        return false;
    }
    const identitiesPath: CustomVisualOpaqueIdentity[] = nodePath.map(node => node.identity);

    let pathLen = 0;
    let lastNodeInPathOperator: HierarchyFilterNodeOperators = 'Inherited';
    let filterByMoreThanOneNode = false;
    let numOfCheckedNodesInPath = 0;
    let currentNodesLevel = treeNodes || [];
    identitiesPath.forEach((identity) => {
        filterByMoreThanOneNode = filterByMoreThanOneNode || (currentNodesLevel.length > 1);
        const index = currentNodesLevel.findIndex((node) => compareIdentites(node.identity, identity));
        if (index === -1) {
            return (pathLen === nodePath.length) && !filterByMoreThanOneNode && (lastNodeInPathOperator !== 'Inherited');
        } else {
            const currentNode = currentNodesLevel![index];
            if (currentNode.operator !== 'Inherited') {
                numOfCheckedNodesInPath++;
            }
            filterByMoreThanOneNode = filterByMoreThanOneNode || (numOfCheckedNodesInPath > 1);
            pathLen++;
            lastNodeInPathOperator = currentNode.operator;
            currentNodesLevel = currentNode.children || [];
        }
    });

    // Handle cases when the entire path is in the tree
    filterByMoreThanOneNode = filterByMoreThanOneNode || !!currentNodesLevel.length

    return (pathLen === nodePath.length) && !filterByMoreThanOneNode && (lastNodeInPathOperator !== 'Inherited');
}



