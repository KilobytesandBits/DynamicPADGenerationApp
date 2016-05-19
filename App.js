Ext
		.define(
				'CustomApp',
				{
					extend : 'Rally.app.App',
					componentCls : 'app',
					launch : function() {
						this._createFeatureWaspiDataStore();
					},

					_createFeatureWaspiDataStore : function() {
						Ext.getBody().mask('Loading...');
						console.log("Rally.environment.getContext().getProject()._ref : ", Rally.environment.getContext().getProject()._ref);

						// Create filter based on settings selection
						var filter;

						milestoneWaspiDataStore = Ext.create('Rally.data.wsapi.Store', {
							model : 'PortfolioItem/Feature',
							autoLoad : true,
							compact : false,
							context : {
								workspace : Rally.environment.getContext().getWorkspace()._ref,
								project : Rally.environment.getContext().getProject()._ref,
								projectScopeUp : false,
								projectScopeDown : true
							},

							fetch : [ 'ObjectID', 'FormattedID', 'Name', 'Description', 'Milestones' ],
							limit : Infinity,
							listeners : {
								load : function(store, data, success) {
									if (data.length > 0) {
										this._createFeatureDataStore(data);
									} else {
										Rally.ui.notify.Notifier.showError({
											message : 'No Feature is associated with the selected Project.'
										});
									}
									Ext.getBody().unmask();
								},
								scope : this
							},
							sorters : [ {
								property : 'Name',
								direction : 'ASC'
							} ]
						});
					},
					/**
					 * Convert the WASPI Data Store for Feature to
					 * Ext.data.Store
					 */
					_createFeatureDataStore : function(myData) {

						var that = this;
						var featureArr = [];

						Ext.each(myData, function(data, index) {
							var feature = {};
							feature.ObjectID = data.data.ObjectID;
							feature.FormattedID = data.data.FormattedID;
							feature.Name = data.data.Name;
							feature.Description = data.data.Description;
							feature.Milestones = data.data.Milestones;

							feature.CurrentDate = Ext.Date.format(new Date(), 'd-M-Y');
							feature.userName = that.getContext().getUser().DisplayName;

							featureArr.push(feature);
						});

						this.milestoneDataStore = Ext.create('Ext.data.Store', {
							fields : [ 'ObjectID', 'FormattedID', 'Name', 'Description', 'Milestones', 'CurrentDate', 'userName' ],
							data : featureArr
						});
						this._createFeaturePicker();
					},

					/**
					 * Create the Ext.form.ComboBox for the Feature
					 */
					_createFeaturePicker : function() {
						this.featurePicker = Ext.create('Ext.form.ComboBox', {
							fieldLabel : 'Select Feature ',
							store : this.milestoneDataStore,
							renderTo : Ext.getBody(),
							displayField : 'Name',
							queryMode : 'local',
							valueField : 'ObjectID',
							border : 1,
							style : {
								borderColor : '#000000',
								borderStyle : 'solid',
								borderWidth : '1px',
								height : '40px'
							},
							width : 400,
							padding : '10 5 5 10',
							margin : '10 5 5 10',
							shadow : 'frame',
							labelAlign : 'right',
							labelStyle : {
								margin : '10 5 5 10'
							},
							listeners : {
								select : function(combo, records, eOpts) {
									this.selectedFeature = combo.getValue();
									this.selectedFeatureObj = records;
									this._getReqData();
								},
								scope : this
							}
						});
						this.add(this.featurePicker);
					},

					/**
					 * Get the required data to generate doc
					 */
					_getReqData : function() {

						Ext.getBody().mask('Fetching Feature data ...');

						Deft.Promise.all([ this._getMileStoneData(), this._getUserStories() ]).then({
							success : function() {
								this._generateDoc();
							},
							scope : this
						});
					},

					/**
					 * Get the milestone data to create the doc
					 */
					_getMileStoneData : function() {

						var that = this;
						var milestone = this.selectedFeatureObj[0].get('Milestones');

						if (milestone !== null && milestone._tagsNameArray !== null && milestone._tagsNameArray.length > 0) {
							filter = Ext.create('Rally.data.wsapi.Filter', {
								property : 'Name',
								operator : '=',
								value : milestone._tagsNameArray[0].Name
							});

							return Ext.create('Rally.data.wsapi.Store', {
								model : 'Milestone',
								autoLoad : true,
								compact : false,
								context : {
									workspace : Rally.environment.getContext().getWorkspace()._ref,
									project : Rally.environment.getContext().getProject()._ref,
									projectScopeUp : false,
									projectScopeDown : true
								},
								filters : filter,
								fetch : [ 'FormattedID', 'Name', 'Notes' ],
								limit : Infinity
							}).load().then({
								success : function(milestone) {
									this.milestoneData = milestone;
								},
								scope : this
							});
						} else {
							this.milestoneData = null;
							return "";
						}

					},

					/**
					 * Get the user stories to create the doc
					 */
					_getUserStories : function() {

						var that = this;

						return Ext.create('Rally.data.wsapi.artifact.Store', {
							models : [ 'userstory' ],
							context : {
								workspace : that.getContext().getWorkspace()._Ref,
								project : null,
								limit : Infinity,
								projectScopeUp : false,
								projectScopeDown : true
							},
							filters : [ {
								property : 'Feature.ObjectID',
								operator : '=',
								value : that.selectedFeature
							} ]
						}).load().then({
							success : function(artifacts) {
								this.userstoryData = artifacts;
							},
							scope : this
						});
					},

					/**
					 * Generate doc using milestone data
					 */
					_generateDoc : function() {

						var milestone = this.selectedFeatureObj[0].get('Milestones');

						var data = this.selectedFeatureObj[0].data;
						data.UserStories = this.userstoryData;
						if (this.milestoneData !== null && this.milestoneData.length > 0) {
							data.Milestone = this.milestoneData[0].data;
						} else {
							data.Milestone = 0;
						}

						console.log("data", data);

						var tpl = new Ext.XTemplate(

								'<div id="page-content" style="font-size: medium;font-family: arial, Verdana, sans-serif"><h1 style="text-align : center;">Product Architecture Document (PAD)</h1>',

								'<br/><br/><br/>',

								'<table><tr><td><span style="text-decoration: underline; font-weight: bold; padding-right: 10px;">Product Name:</span><td> <td> <tpl if="Milestone !== 0 "> {Milestone.FormattedID} - {Milestone.Name} <tpl else> &nbsp; </tpl></td></tr>',
								'<tr><td><span style="text-decoration: underline; font-weight: bold; padding-right: 10px;">Feature Name:</span><td> <td>{FormattedID} - {Name}</td></tr>',
								'<tr><td><span style="text-decoration: underline; font-weight: bold; padding-right: 10px;">Date:</span><td> <td>{CurrentDate}</td></tr>',
								'<tr><td><span style="text-decoration: underline; font-weight: bold; padding-right: 10px;">Contact:</span><td> <td>{userName}</td></tr>',
								'<tr><td><span style="text-decoration: underline; font-weight: bold; padding-right: 10px;">Department:</span><td> <td style="color: blue;">&lt;Enter department name.&gt;</td></tr>',
								'<tr><td><span style="text-decoration: underline; font-weight: bold; padding-right: 10px;">Location:</span><td> <td style="color: blue;">&lt;Enter office location of primary document owner.&gt;</td></tr>',
								'</table>',
								
								'<div style="font-size: small; font-family: arial, Verdana, sans-serif">',
								'<p style="page-break-before: always;">&nbsp;</p>',
								'<p style="text-decoration: underline; font-weight: bold; padding-right: 10px;">Document Revision History:</p>',

								'<table style="border-collapse: collapse; border: 1px solid black; width: 590px;"><tr><th style="border: 1px solid black;">&nbsp;Date&nbsp;</th><th style="border: 1px solid black;">&nbsp;Revision&nbsp;</th><th style="border: 1px solid black;">&nbsp;Description&nbsp;</th><th style="border: 1px solid black;">&nbsp;Author&nbsp;</th></tr>',
								'<tr><td style="border: 1px solid black;">&nbsp;{CurrentDate}&nbsp;</td><td style="border: 1px solid black;">&nbsp;0.1&nbsp;</td><td style="border: 1px solid black;">&nbsp;Initial PAD&nbsp;</td><td style="border: 1px solid black;">&nbsp;{userName}&nbsp;</td></tr>',
								'<tr style="color: blue;"><td style="border: 1px solid black;">&nbsp;&lt;Enter date&gt;&nbsp;</td><td style="border: 1px solid black;">&nbsp;&lt;#.&gt;&nbsp;</td><td style="border: 1px solid black;">&nbsp;&lt;Descibe Changes.&gt;&nbsp;</td><td style="border: 1px solid black;">&nbsp;&lt;Enter Name.&gt;&nbsp;</td></tr>',
								'<tr><td style="border: 1px solid black;">&nbsp;</td><td style="border: 1px solid black;">&nbsp;</td><td style="border: 1px solid black;">&nbsp;</td><td style="border: 1px solid black;">&nbsp;</td></tr>',
								'<tr><td style="border: 1px solid black;">&nbsp;</td><td style="border: 1px solid black;">&nbsp;</td><td style="border: 1px solid black;">&nbsp;</td><td style="border: 1px solid black;">&nbsp;</td></tr>',
								'</table>',
								
								'<p style="page-break-before: always;">&nbsp;</p>',
								
								'<ol>',
								'<li style="padding-bottom: 15px;"><h2 style="font-size: 18px; background-color: gray;color: white;border-top: 2px solid black;border-bottom: 2px solid black;"> Overview <br/> </h2>',
								'<ol>',
								'<li>',
								'<h3>Document Objective</h3>',
								'<p>The Product Architecture Document (PAD) provides a detailed definition of one or more high-level features specified in a PRD.  The definition includes both behavioral and architectural specifications. </p>',
								'</li>',
								'<li>',
								'<h3>General description</h3>',
								'<p style="color: blue;">&lt;Provide orientation to the product/release being specified. This is an overview of the product/release to orient the reader and provide a summary that interested project stakeholders can read to understand the product/release requirements at a high level.&gt; </p>',
								'<p>{Description}</p>',
								'</li>',
								'<li>',
								'<h3>Related Documents</h3>',
								'<p style="color: blue;">&lt;Links or references to the related documents like PRD or other PADs.&gt; </p>',
								'<p>{Description}</p>',
								'</li>',
								'</ol>',
								'</li>',
								'<li style="padding-bottom: 15px;"><h2 style="font-size: 18px; background-color: gray;color: white;border-top: 2px solid black;border-bottom: 2px solid black;"> Additional Requirements <br/> </h2>',
								'<p style="color: blue;">&lt;Requirements should be precise, measurable, and verifiable. Specify non-functional requirements, and cross-cutting requirements that can be described more clearly with simple statements, such as "Full functionality is available through both IE and Firefox".&gt; </p>',
								'<ol>',
								'<li>',
								'Requirement 1',
								'</li>',
								'<li>',
								'Requirement 2',
								'</li>',
								'</ol>',
								'</li>',
								'<li style="padding-bottom: 15px;"><h2 style="font-size: 18px; background-color: gray;color: white;border-top: 2px solid black;border-bottom: 2px solid black;"> Functional Description <br/> </h2>',
								'<p style="color: blue;">&lt;Describe in detail all aspects of this project which will be user visible. Include UI wireframe mock-ups if the project will include new or modified UI components.  For screens with complex behaviors or multiple views, include a mock-up showing each state.  These screenshots should have corresponding text that describes any special interactive behaviors that are not obvious from looking at a static picture.&gt; </p>',
								'<ol>', '<tpl for="UserStories">', '<li><h3>{data.FormattedID} - {data.Name}<br/></h3><ol><li>{data.Description}<br/></li><li> Wireframe/Screenshot 1 <br/></li> <li> Wireframe/Screenshot 2 <br/></li> </ol> </li>', '</tpl>',
								'</ol>',
								'</li>',
								'<li style="padding-bottom: 15px;"><h2 style="font-size: 18px; background-color: gray;color: white;border-top: 2px solid black;border-bottom: 2px solid black;"> Non Goals <br/> </h2>',
								'<p style="color: blue;">&lt;List the non-goals of this release. The non-goals are those features that are explicitly NOT going to be implemented for this release.&gt; </p>',
								'</li>',
								'<li style="padding-bottom: 15px;"><h2 style="font-size: 18px; background-color: gray;color: white;border-top: 2px solid black;border-bottom: 2px solid black;"> Architecture <br/> </h2>',
								'<p style="color: blue;">&lt;Architectural description detailed enough to support estimates.  This section may contain high-level description, class diagrams, interaction diagram, and/or code snips.&gt; </p>',
								'</li>',
								'<li style="padding-bottom: 15px;"><h2 style="font-size: 18px; background-color: gray;color: white;border-top: 2px solid black;border-bottom: 2px solid black;"> Estimates <br/> </h2>',
								'<p>',
								'<table style="border-collapse: collapse; border: 1px solid black; width: 590px;"><tr><th style="border: 1px solid black;">&nbsp;Task&nbsp;</th><th style="border: 1px solid black;">&nbsp;Estimate (person days)&nbsp;</th></tr>',
								'<tr><td style="border: 1px solid black;">&nbsp;</td><td style="border: 1px solid black;">&nbsp;</td></tr>',
								'<tr><td style="border: 1px solid black;">&nbsp;</td><td style="border: 1px solid black;">&nbsp;</td></tr>',
								'</table>',
								'</p>',
								'</li>',
								'</ol>',
								
								

								'</div> </div>');

						if (this.down('#doc-container') !== null) {
							this.down('#doc-container').destroy();
						}

						this.add({
							xtype : 'container',
							id : 'doc-container',
							html : tpl.apply(data)
						});

						var exportToDocBtn = Ext.create('Ext.Button', {
							text : 'Save as .doc',
							scale : 'large',
							cls : 'custExprtBtnCls',
							handler : function() {
								$("#page-content").wordExport("PAD - " + data.Name);
							}
						});

						this.down('#doc-container').add(exportToDocBtn);

						Ext.getBody().unmask();

						//$("#page-content").wordExport();
					}
				});
