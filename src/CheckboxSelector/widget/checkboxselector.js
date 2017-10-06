
define([
	'dojo/_base/declare',
	'mxui/widget/_WidgetBase',
	'dojo/dom-class',
	'dojo/dom-construct',
	'dojo/on',
	'dojo/query',
	'dojo/_base/lang',
	'dojo/mouse',
	'dojo/dom-attr',
	'dojo/dom-style',
	'dojo/_base/connect',
	'dojo/_base/array',
	'mxui/dom'
], function (declare, _WidgetBase, domClass, domConstruct, on, query, lang, mouse, domAttr, domStyle, connect, array, dom) {
	return declare('CheckboxSelector.widget.checkboxselector', [_WidgetBase], {

		nameAttr: '',
		sortAttr: '',
		sortOrder: '',
		useHeaders: true,
		readonly: false,
		boxWidth: 25,
		boxWidthUnit: "",
		headers: '',
		displayWidth: '',
		displayAttrs: '',
		currency: 'None',
		useSeparators: '',
		constraint: '',
		limit: 0,
		onchangemf: '',
		listenchannel: '',
		beginEmpty: false,
		hasSelectAll: true,
		unused: null,

		//Caches
		context: null,
		_hasStarted: false,
		assoc: null,
		referredEntity: null,
		rowsList: null,
		ignoreChange: false,
		isInactive: false,
		isDisabled: false,
		readOnlyBool: false,
		validationDiv: null,
		changeHandler: null,
		changeHandler2: null,

		readonly: false,


		startup: function () {
			if (this._hasStarted)
				return;

			this._hasStarted = true;
			domConstruct.empty(this.domNode);
			this.rowsList = {};
			domClass.add(this.domNode, 'checkboxSelector_widget');
		},

		update: function (obj, callback) {
			//Make sure the table is only rendered ONCE.
			if (query(":first-child", this.domNode).length == 0) {
				this.getAssocObjs(obj);
			}
			callback && callback();
		},

		postMixInProperties: function () {
			this.inherited(arguments);
			if (this.boxWidthUnit == "u0000") {
				this.boxWidthUnit = "";
			} else if (this.boxWidthUnit == "u0025") {
				this.boxWidthUnit = "%";
			}
		},

		getAssocObjs: function (context) {
			this.context = context;
			var contextGUID = context.getGuid();

			var nameSplit = this.nameAttr.split("/");
			this.assoc = nameSplit[0];
			this.referredEntity = nameSplit[1];

			this.readOnlyBool = context.isReadonlyAttr(this.assoc);

			if (this.readOnlyBool == true || this.readonly == true || this.isDisabled == true)
				this.isInactive = true;
			else
				this.isInactive = false;

			this.unsubscribe(this.changeHandler);
			this.unsubscribe(this.changeHandler2);
			this.unsubscribe(this.validationHandler);
			this.changeHandler = this.subscribe({ guid: contextGUID, attr: this.assoc, callback: lang.hitch(this, this.changeReceived) });
			this.changeHandler2 = this.subscribe({ guid: contextGUID, callback: lang.hitch(this, this.objChangeReceived) });
			this.validationHandler = this.subscribe({ guid: contextGUID, val: true, callback: lang.hitch(this, this.validationUpdate) });

			var xpath = "//" + this.referredEntity + this.constraint.replace(/\[\%CurrentObject\%\]/gi, contextGUID);

			mx.data.get({
				'xpath': xpath,
				'filter': {
					'limit': this.limit + "",
					'sort': [[this.sortAttr, this.sortOrder]]
				},
				'error': function () {
					logger.error("Checkbox Selector Widget: Retrieve objects failed.");
				},
				'callback': lang.hitch(this, this.renderList)
			});

		},


		renderList: function (objs) {
			domConstruct.empty(this.domNode);
			var selectedObjs = this.context.getReferences(this.assoc);

			var table = dom.create('table', { 'class': 'mendixDataGrid_gridTable table-bordered', 'cellPadding': '0px', 'cellSpacing': '0px' });
			var surrDiv = dom.create('div', { 'class': 'mendixDataGrid_tablePane' }, table);

			if (this.useHeaders) {
				var headTr = dom.create('tr', { 'class': 'mendixDataGrid_tableRow' });
				var thead = dom.create('thead', { 'class': 'mendixDataGrid_gridHead' }, headTr);
				var checkall = '';
				if (this.hasSelectAll) {
					checkall = dom.create('input', { type: 'checkbox', 'class': 'checkbox_checkall' });
					var checkallBool = (selectedObjs.length == objs.length);
					checkall.checked = checkallBool;
					if (this.isInactive) {
						domAttr.set(checkall, "disabled", "disabled");
					}
				}

				var checkboxHeadTh = dom.create('th',
					{ 'class': 'mendixDataGrid_tableHead mendixDataGrid_tableHeadFirst' },
					dom.create('div',
						{ 'class': 'mendixDataGrid_headContainer' },
						dom.create('div',{ 'class': 'mendixDataGrid_sortIcon' }),
						dom.create('div',{ 'class': 'mendixDataGrid_columnCaption' }, 
								checkall
						)
					)
				);

				this.boxWidth && domStyle.set(checkboxHeadTh, 'width', this.boxWidth + this.boxWidthUnit);

				headTr.appendChild(checkboxHeadTh);

				for (var k = 0; k < this.splits.length; k++) {
					var headTh = dom.create('th',{ 'class': 'mendixDataGrid_tableHead', 'width': this.splits[k].displayWidth + '%' },
						dom.create('div', { 'class': 'mendixDataGrid_headContainer' },
							dom.create('div', { 'class': 'mendixDataGrid_sortIcon' }),
							dom.create('div', { 'class': 'mendixDataGrid_columnCaption' }, this.splits[k].headers)));

					if (k == this.splits.length - 1)
						domClass.add(headTh, 'mendixDataGrid_tableHeadLast');

					headTr.appendChild(headTh);
				}
				table.appendChild(thead);
			}

			var tbody = dom.create('tbody', { 'class': 'mendixDataGrid_gridBody' });
			table.appendChild(tbody);

			this.hoverNode = null;
			for (var i = 0; i < objs.length; i++) {
				var bodyTr = dom.create('tr', { 'class': 'mendixDataGrid_tableRow' });
				tbody.appendChild(bodyTr);

				var currObj = objs[i];
				var currGUID = currObj.getGuid();
				var checkBool = (array.indexOf(selectedObjs, currGUID) != -1);

				var checkbox = dom.create('input', { type: 'checkbox', 'class': 'checkbox_box' });
				checkbox.checked = checkBool;

				domAttr.set(checkbox, 'defaultChecked', checkBool);

				this.rowsList[currGUID] = checkbox;

				// DRE: Unfortunatly this is not a boolean, if the attribute is there the node will be disabled.
				this.isInactive && domAttr.set(checkbox, "disabled", "disabled" ); 

				if (i % 2 !== 0)
					domClass.add(bodyTr, 'mendixDataGrid_tableRowEven');
				else
					domClass.add(bodyTr, 'mendixDataGrid_tableRowOdd');

				var checkboxTd = dom.create('td', { 'class': 'mendixDataGrid_tableData' }, checkbox);

				this.boxWidth && domStyle.set(checkboxTd, 'width', this.boxWidth + this.boxWidthUnit);

				bodyTr.appendChild(checkboxTd);

				mxui.dom.data(bodyTr, {
					'obj': currObj,
					'checkbox': checkbox
				});

				for (var j = 0; j < this.splits.length; j++) {
					var splitobj = this.splits[j];
					var tdDiv = dom.create('div');
					var bodyTd = dom.create('td', { 'class':'mendixDataGrid_tableData gridselector_column'+j, 'width' : this.splits[j].displayWidth+'%'}, tdDiv);
					bodyTr.appendChild(bodyTd);
					currObj.fetch(this.splits[j].displayAttrs, lang.hitch(this, function (currObj, tdDiv, value) {
						if (value) {
							if (currObj.isEnum(this.splits[j].displayAttrs)) {
								displayAttr = currObj.getEnumCaption(this.splits[j].displayAttrs, value) || '';
							} else {
								displayAttr = value || '';
							}
						} else {
							displayAttr = '';
						}

						var fromattedValue = mx.parser.formatAttribute(currObj, splitobj.displayAttrs, {
							places: 2, groups: splitobj.useSeparators
						});;
						switch (splitobj.currency) {
							case 'None':
								tdDiv.innerHTML = displayAttr;
								break;
							case 'Euro':
								if (displayAttr !== '') {
									tdDiv.innerHTML = '&#8364 ' + fromattedValue;
								}
								break;
							case 'Dollar':
								if (displayAttr !== '') {
									tdDiv.innerHTML = '&#36 ' + fromattedValue;
								}
								break;
							case 'Yen':
								if (displayAttr !== '') {
									tdDiv.innerHTML = '&#165 ' + fromattedValue;
								}
								break;
							case 'Pound':
								if (displayAttr !== '') {
									tdDiv.innerHTML = '&#163 ' + fromattedValue;
								}
								break;
							default:
								break;
							// type not found
						}
					}, currObj, tdDiv));
				}

			}
			/*
			* Publish to formloader
			*/
			if (this.listenchannel !== '' && objs[0] && !this.beginEmpty)
				connect.publish(this.getContent() + "/" + this.listenchannel + "/context", [objs[0]]);

			surrDiv['tabIndex'] = 0;
			this.domNode.appendChild(surrDiv);
			this.validationDiv = domConstruct.create('div', { 'display': 'none' });
			domClass.add(this.validationDiv, 'mendixReferenceSetSelector_invalidNode');
			this.domNode.appendChild(this.validationDiv);

			query('td', this.domNode).on('click', lang.hitch(this, function (e) {
				if (!e.stopme) {
					var obj = mxui.dom.data(e.currentTarget.parentNode, 'obj');
					if (this.listenchannel !== '') {
						this.publishObj(obj);
					} else {
						var checkbox = mxui.dom.data(e.currentTarget.parentNode, 'checkbox');

						// DRE: It appears that mxui.dom.data does just stick stuff on the dom node and return the dom node aswell
						if (!domAttr.get(checkbox, "disabled")) {
							checkbox.checked = !checkbox.checked;
							this.boxChanged(obj.getGuid(), checkbox.checked);
						}
					}
				}
			}));

			query('tr', this.domNode).on(mouse.enter, lang.hitch(this, function (e) {
				var node = e.currentTarget;
				if (node != this.hoverNode) {
					this.hoverNode && domClass.remove(this.hoverNode, 'mendixDataGrid_tableRowHover');
					domClass.add(node, 'mendixDataGrid_tableRowHover');
					this.hoverNode = node;
				}
			}
			));

			query('input', this.domNode).on('click', lang.hitch(this, function (e) {
				if (!domClass.contains(e.currentTarget, 'checkbox_checkall')) {
					var obj = mxui.dom.data(e.currentTarget.parentNode.parentNode, 'obj');
					var checkbox = mxui.dom.data(e.currentTarget.parentNode.parentNode, 'checkbox');
					this.boxChanged(obj.getGuid(), e.currentTarget.checked);
					e.stopme = true;
				} else {
					this.checkOrUncheckAll(e);
					e.stopme = true;
				}
			}));
		},

		publishObj: function (obj) {
			if (this.listenchannel !== '')
				connect.publish(this.getContent() + "/" + this.listenchannel + "/context", [obj]);
		},
		boxChanged: function (guid, checked) {
			if (checked) {
				this.context.addReference(this.assoc, guid);
			} else {
				this.context.removeReferences(this.assoc, [guid]);
			}


			if (this.context.hasChanges()) {
				mx.data.commit({
					mxobj: this.context,
					callback: function () {
						//ok
					},
					error: function (e) {
						logger.error('Could not save object: ' + this.context + 'with error: ' + e && e);
					}
				});
			}

			if (!this.ignoreChange) {
				if (this.onchangemf) {
					this.ignoreChange = true;
					var context = new mendix.lib.MxContext();

					if (this.context) {
						context.setContext(this.context.getEntity(), this.context.getGuid());
					}

					mx.ui.action(this.onchangemf, {
						context: context,
						callback: function () {
						},
						error: function (e) {
							logger.error('Could not execute microflow: ' + this.onchangemf + 'with error: ' + e && e);
						}
					});

					setTimeout(lang.hitch(this, function () {
						this.ignoreChange = false;
					}), 0);
				}
			}
		},

		checkOrUncheckAll: function (e) {
			var checkboxes = []
			var objs = query('obj');
			var allBoxes = query('input');
			for (i = 0; i < allBoxes.length; i++) {
				if (domClass.contains(allBoxes[i], 'checkbox_box')) {
					checkboxes.push(allBoxes[i]);
				}
			}

			for (i = 0; i < checkboxes.length; i++) {
				var obj = mxui.dom.data(checkboxes[i].parentNode.parentNode, 'obj');
				this.boxChanged(obj.getGuid(), e.currentTarget.checked);
			}
		},

		objChangeReceived: function (guid) {
			mx.data.get({
				guid: guid,
				callback: lang.hitch(this, function (obj) {
					this.changeReceived(guid, this.assoc, obj.get(this.assoc));
				})
			});
		},
		changeReceived: function (guid, attr, value) {
			// guid = contextguid
			// attr = association
			// value = all the new guids in the assoc
			if (guid != this.context.getGuid())
				return;

			for (var key in this.rowsList) {
				var checked = array.indexOf(value, key);
				if (checked != -1)
					domAttr.set(this.rowsList[key], 'checked', true);
				else
					domAttr.set(this.rowsList[key], 'checked', false);
			}
		},

		objectUpdateNotification: function () {
			if (this.context && this.context.getGuid())  //mwe: refresh triggered, reload the references
				this.changeReceived(this.context.getGuid(), this.assoc, this.context.getReferences(this.assoc));

			if (this.validationDiv)
				domStyle.set(this.validationDiv, 'display', 'none');
		},
		validationUpdate: function (validations) {
			for (var i = 0; i < validations.length; i++) {
				var fields = validations[i].getFields();
				for (var x = 0; x < fields.length; x++) {
					var field = fields[x];
					var name = field.name;
					var reason = field.reason;
					if (name == this.assoc) {
						validations[i].removeAttribute(this.assoc);
						domStyle.set(this.validationDiv, 'display', 'block');
						this.validationDiv.innerHTML = reason;
					}
				}
			}
		},
		_setDisabledAttr: function (value) {
			this.isDisabled = !!value;
		},

		uninitialize: function () {
			this.rowsList = null;
			domConstruct.empty(this.domNode);
			// this.removeChangeSubscriptions();
		}
	});
});
require(['CheckboxSelector/widget/checkboxselector']);
