dojo.provide("widgets.widgets");
dojo.registerModulePath("CheckboxSelector", "../../widgets/CheckboxSelector");
dojo.provide("CheckboxSelector.widget.checkboxselector");
dojo.require("dijit.form.CheckBox");

mendix.widget.declare("CheckboxSelector.widget.checkboxselector", {
  
	inputargs  : {
		nameAttr		: '',
		sortAttr		: '',
		sortOrder		: '',
		useHeaders      : true,
		readonly		: false,
		boxWidth        : 25,
		boxWidthUnit    : "",
		headers			: '',
		displayWidth	: '',
		displayAttrs	: '',
		currency		: 'None',
		useSeparators	: '',
		constraint		: '',
		limit			: 0,
		onchangemf		: '',
		listenchannel	: '',
		beginEmpty		: false, 
		hasSelectAll	: true, 
		unused			: null
	},
	
	//Caches
	context : null,
	_hasStarted : false,
	assoc : null,
	referredEntity : null,
	rowsList : null,
	ignoreChange : false,
	isInactive : false,
	isDisabled : false,
	readOnlyBool : false,
	validationDiv : null,
	changeHandler : null,
	changeHandler2 : null,
	
	readonly: false,
	
	
	startup : function(){
		if (this._hasStarted)
			return;

		this._hasStarted = true;
		dojo.empty(this.domNode);
		this.rowsList = {};
		mxui.dom.addClass(this.domNode, 'checkboxSelector_widget');

		if (dojo.version.major < 5) {
			this.splits = [];
			this.splitPropsTo('displayAttrs,currency,useSeparators,headers,displayWidth',this.splits);
		}
		
		this.actRendered();
	},

	update : function (obj, callback) {
		//Make sure the table is only rendered ONCE.
		if (dojo.query(":first-child", this.domNode).length == 0) {
			this.getAssocObjs(obj);
		}
		callback && callback();
	},

	postMixInProperties: function( ){
		this.inherited( arguments );
		if (this.boxWidthUnit == "u0000"){
			this.boxWidthUnit="";
		} else if (this.boxWidthUnit == "u0025") {
			this.boxWidthUnit="%";
		}
	},

	getAssocObjs : function(context) {
		this.context = context;
		var contextGUID = context.getGUID();
		
		var nameSplit = this.nameAttr.split("/");
		this.assoc = nameSplit[0];
		this.referredEntity = nameSplit[1];
		
		this.readOnlyBool = context.isReadonlyAttr(this.assoc);
		
		if (this.readOnlyBool == true || this.readonly == true || this.isDisabled == true )
			this.isInactive = true;
		else
			this.isInactive = false;
		
		this.unsubscribe(this.changeHandler);
		this.unsubscribe(this.changeHandler2);
		this.unsubscribe(this.validationHandler);
		this.changeHandler = this.subscribe({guid: contextGUID, attr: this.assoc, callback : dojo.hitch(this, this.changeReceived)});
		this.changeHandler2 = this.subscribe({guid: contextGUID, callback : dojo.hitch(this, this.objChangeReceived)});
		this.validationHandler = this.subscribe({guid: contextGUID, val : true, callback : dojo.hitch(this, this.validationUpdate)});
		
		var xpath = "//" + this.referredEntity + this.constraint.replace(/\[\%CurrentObject\%\]/gi, contextGUID);
		
		mx.processor.get({
			'xpath'		: xpath,
			'filter'	: {
				'limit' : this.limit+"",
				'sort'	: [[this.sortAttr, this.sortOrder]]
			},
			'error'		: function () {
				logger.error("Checkbox Selector Widget: Retrieve objects failed.");
			},
			'callback'	: dojo.hitch(this, this.renderList)
		});
		
	},


	renderList : function (objs) {
		dojo.empty(this.domNode);
		var selectedObjs = this.context.getReferences(this.assoc);

		var table = mxui.dom.table( { 'class': 'mendixDataGrid_gridTable table-bordered', 'cellPadding': '0px', 'cellSpacing' : '0px'});
		var surrDiv = mxui.dom.div( { 'class': 'mendixDataGrid_tablePane'}, table);
		
		if (this.useHeaders) {
			var headTr = mxui.dom.tr( { 'class' : 'mendixDataGrid_tableRow'});
			var thead = mxui.dom.thead({ 'class' : 'mendixDataGrid_gridHead'}, headTr);
			var checkall = '';
			if(this.hasSelectAll) {
				checkall = mxui.dom.input({ type : 'checkbox', 'class' : 'checkbox_checkall'});
				var checkallBool = (selectedObjs.length == objs.length);
				checkall.checked = checkallBool;
				if(this.isInactive){
					dojo.attr(checkall, "disabled", "disabled");
				}
			}
			
			var checkboxHeadTh = mxui.dom.th(
					{ 'class': 'mendixDataGrid_tableHead mendixDataGrid_tableHeadFirst' },
					mxui.dom.div(
						{ 'class': 'mendixDataGrid_headContainer' },
						mxui.dom.div({ 'class': 'mendixDataGrid_sortIcon' }),
						mxui.dom.div({ 'class': 'mendixDataGrid_columnCaption' }, 
								checkall
						)
					)
				);
			
			this.boxWidth && dojo.style( checkboxHeadTh, { width: this.boxWidth + this.boxWidthUnit });
			
			headTr.appendChild(checkboxHeadTh);
			
			for (var k = 0; k < this.splits.length; k++) {
				var headTh = mxui.dom.th({ 'class' : 'mendixDataGrid_tableHead', 'width' : this.splits[k].displayWidth+'%'},
								mxui.dom.div({ 'class' : 'mendixDataGrid_headContainer' },
									mxui.dom.div( { 'class' : 'mendixDataGrid_sortIcon' }),
									mxui.dom.div({ 'class' : 'mendixDataGrid_columnCaption' }, this.splits[k].headers)));
				
				if (k == this.splits.length-1)
					mxui.dom.addClass(headTh, 'mendixDataGrid_tableHeadLast');
				
				headTr.appendChild(headTh);
			}
			table.appendChild(thead);
		}
		
		var tbody = mxui.dom.tbody( { 'class' : 'mendixDataGrid_gridBody' });
		table.appendChild(tbody);

		this.hoverNode = null;
		this.liveConnect(table, 'onclick', {
			'td' : dojo.hitch(this, function(e) {
				if (!e.stopme) {
					var obj = mxui.dom.data(e.currentTarget.parentNode, 'obj');
					if (this.listenchannel !== ''){
						this.publishObj(obj);
					} else {
						var checkbox = mxui.dom.data(e.currentTarget.parentNode, 'checkbox');

						// DRE: It appears that mxui.dom.data does just stick stuff on the dom node and return the dom node aswell
						if( !dojo.attr( checkbox, "disabled" ) ){
							checkbox.checked = !checkbox.checked;
							this.boxChanged(obj.getGUID(), checkbox.checked);
						}
					}
				}
			}),
			'input' : dojo.hitch(this, function(e) {
				if(!dojo.hasClass(e.currentTarget, 'checkbox_checkall')) {
					var obj = mxui.dom.data(e.currentTarget.parentNode.parentNode, 'obj');
					var checkbox = mxui.dom.data(e.currentTarget.parentNode.parentNode, 'checkbox');
					this.boxChanged(obj.getGUID(), e.currentTarget.checked);
					e.stopme = true;
				} else {
					this.checkOrUncheckAll(e);
					e.stopme = true;
				}
			})
		});
		this.liveConnect(table, 'onmousemove', {
			'tr' : dojo.hitch(this, function (e) {
				var node = e.currentTarget;
				if (node != this.hoverNode) {
					this.hoverNode && mxui.dom.removeClass(this.hoverNode,'mendixDataGrid_tableRowHover');
					mxui.dom.addClass(node,'mendixDataGrid_tableRowHover');
					this.hoverNode = node;
				}
			}
		)});

		for(var i = 0; i < objs.length; i++) {
			var bodyTr = mxui.dom.tr( {'class': 'mendixDataGrid_tableRow'});
			tbody.appendChild(bodyTr);
			
			var currObj = objs[i];
			var currGUID = currObj.getGUID();
			var checkBool = (dojo.indexOf(selectedObjs, currGUID)!=-1);
			
			var checkbox = mxui.dom.input({ type : 'checkbox', 'class' : 'checkbox_box'});
			checkbox.checked = checkBool;
			
			dojo.attr(checkbox, 'defaultChecked', checkBool);

			this.rowsList[ currGUID ] = checkbox;
			
			// DRE: Unfortunatly this is not a boolean, if the attribute is there the node will be disabled.
			this.isInactive && dojo.attr( checkbox, "disabled", "disabled" ); 
			
			if (i%2 !== 0)
				mxui.dom.addClass(bodyTr, 'mendixDataGrid_tableRowEven');
			else
				mxui.dom.addClass(bodyTr, 'mendixDataGrid_tableRowOdd');
			
			var checkboxTd = mxui.dom.td({ 'class':'mendixDataGrid_tableData' }, checkbox);
			
			this.boxWidth && dojo.style( checkboxTd, { width: this.boxWidth + this.boxWidthUnit });
			
			bodyTr.appendChild(checkboxTd);

			mxui.dom.data(bodyTr, {
				'obj' : currObj,
				'checkbox' : checkbox
			});

			for(var j = 0; j < this.splits.length; j++) {
				var splitobj = this.splits[j];
				var tdDiv = mxui.dom.div();
				var bodyTd = mxui.dom.td( { 'class':'mendixDataGrid_tableData gridselector_column'+j, 'width' : this.splits[j].displayWidth+'%'}, tdDiv);
				bodyTr.appendChild(bodyTd); 
				currObj.fetch(this.splits[j].displayAttrs, dojo.hitch(this, function(currObj, tdDiv, value){
				 if(value){
				     if(currObj.getAttributeClass(value) == 'Enum') {
				      displayAttr = currObj.getEnumCaption(value) || '';
				     } else {
				      displayAttr = value || '';
				     }
				 } else {
				 	displayAttr = '';
				 }
			     var currency;
			     switch(splitobj.currency) {
			      case 'None' :
			       tdDiv.innerHTML = displayAttr;
			       break;
			      case 'Euro' :
			       if (displayAttr !== '') {
			        currency = '&#8364 '+mx.parser.formatNumber(displayAttr, splitobj.useSeparators, 2);
			        tdDiv.innerHTML = currency;
			       }
			       break;
			      case 'Dollar' :
			       if (displayAttr !== '') {
			        currency = '&#36 '+mx.parser.formatNumber(displayAttr, splitobj.useSeparators, 2);
			        tdDiv.innerHTML = currency;
			       }
			       break;
			      case 'Yen' :
			       if (displayAttr !== '') {
			        currency = '&#165 '+mx.parser.formatNumber(displayAttr, splitobj.useSeparators, 2);
			        tdDiv.innerHTML = currency;
			       }
			       break;
			      case 'Pound' :
			       if (displayAttr !== '') {
			        currency = '&#163 '+mx.parser.formatNumber(displayAttr, splitobj.useSeparators, 2);
			        tdDiv.innerHTML = currency;
			       }
			       break;
			      default :
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
			dojo.publish(this.getContent() + "/"+this.listenchannel+"/context", [objs[0]]);
		
		surrDiv['tabIndex'] = 0;
		this.domNode.appendChild(surrDiv);
		this.validationDiv = mxui.dom.div({'display':'none'});
		mxui.dom.addClass(this.validationDiv, 'mendixReferenceSetSelector_invalidNode');
		this.domNode.appendChild(this.validationDiv);
	},
	publishObj : function (obj) {
		if (this.listenchannel !== '')
			dojo.publish(this.getContent() + "/"+this.listenchannel+"/context", [obj]);
	},
	boxChanged : function (guid, checked) {
		if (checked) {
			this.context.addReference(this.assoc, guid);
		} else {
			this.context.removeReferences(this.assoc, [guid]);
		}


		if(this.context.hasChanges()) {
			this.context.save({
				callback: function(){
					//ok
				},
				error: function(e) {
					logger.error('Could not save object: '+this.context+'with error: '+e&&e);
				}
			});
		}

		if(!this.ignoreChange){
			if(this.onchangemf) {
				this.ignoreChange = true;
				var context = mx.ui.newContext();
				
				if(this.context) {
					context.setContext(this.context.getClass(), this.context.getGUID());
				}
				
				mx.xas.action({
					actionname	: this.onchangemf,
					context		: context,
					callback	: function() {
					},
					error		: function(e) {
						logger.error('Could not execute microflow: '+this.onchangemf+'with error: '+e&&e);
					}
				});
				
				mx.ui.destroyContext(context);
				setTimeout(dojo.hitch(this, function() {
					this.ignoreChange = false;
				}), 0);
			}
		}
	},

	checkOrUncheckAll : function(e) {
		var checkboxes = []
		var objs = mxui.dom.getElementsByTagNames(this.domNode, 'obj');
		var allBoxes = mxui.dom.getElementsByTagNames(this.domNode, 'input');
		for (i = 0; i < allBoxes.length; i++){
			if (dojo.hasClass(allBoxes[i], 'checkbox_box')){
				checkboxes.push(allBoxes[i]);
			}
		}

		for (i = 0; i < checkboxes.length; i++){		
			var obj = mxui.dom.data(checkboxes[i].parentNode.parentNode, 'obj');
			this.boxChanged(obj.getGUID(), e.currentTarget.checked);
		}
	},

	objChangeReceived : function (guid) {
		mx.processor.get({
			guid : guid,
			callback : dojo.hitch(this, function (obj) {
				this.changeReceived(guid, this.assoc, obj.get(this.assoc));
			})
		});
	},
	changeReceived : function (guid, attr, value) {
		// guid = contextguid
		// attr = association
		// value = all the new guids in the assoc
		if (guid != this.context.getGUID())
			return;

		for (var key in this.rowsList) {
			var checked = dojo.indexOf(value, key);
			if (checked != -1)
				dojo.attr(this.rowsList[key],'checked', true);
			else
				dojo.attr(this.rowsList[key],'checked', false);
		}
	},

	/**
	 * splits the given properties up to objects in target per index. First property indicates targetobjects name
	 */
	splitPropsTo : function(propnames, target) {
		var props = propnames.split(",");
		var rawdata = {};

		var nameprop = props[0];
		for(var i = 0; i < props.length; i++) 
			rawdata[props[i]] = this[props[i]].split(";");
		
		//create target objects
		for(var i = 0; i < rawdata[nameprop].length; i++){
			var obj = {};
			var hasdata = false;
			for (var key in rawdata) {
				var val = obj[key] = rawdata[key][i];
				if (/^true$/.test(obj[key]))
					obj[key] = true;
				else if (/^false$/.test(obj[key]))
					obj[key] = false;
				hasdata = hasdata || (val !== "");
			}
			if (hasdata) //if the object does not contain any data at all, skip it
				target.push(obj);
		}
	},

	objectUpdateNotification : function () {
		if (this.context && this.context.getGUID())  //mwe: refresh triggered, reload the references
			this.changeReceived(this.context.getGUID(), this.assoc, this.context.getReferences(this.assoc));
			
		if (this.validationDiv)
			dojo.style(this.validationDiv, 'display', 'none');
	},
	validationUpdate : function (validations) {
		for (var i=0; i<validations.length; i++) {
			var fields = validations[i].getFields();
			for(var x=0;x< fields.length;x++) {
				var field = fields[x];
				var name = field.name;
				var reason = field.reason;
				if (name == this.assoc) {
					validations[i].removeAttribute(this.assoc); 
					dojo.style(this.validationDiv, 'display', 'block');
					this.validationDiv.innerHTML = reason;
				}
			}
		}
	},
	_setDisabledAttr : function(value) {
		this.isDisabled = !!value;
	},

	uninitialize : function(){
		this.rowsList = null;
		this.removeChangeSubscriptions();
	}
});;
