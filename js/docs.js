// A simple AIR application to allow easy editing for RST documentation sources.
// (c) Nikolai Onken / uxebu Consulting Ltd. & Cg. KG
//
// Licenced under the MIT licence

dojo.require("dojox.dtl");
dojo.require("dojox.dtl.Context");

dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.TabContainer");
dojo.require("dijit.layout.ContentPane");

// Data
dojo.require("dojo.data.ItemFileReadStore");

// Components
dojo.require("dijit.Tree");
dojo.require("dijit.tree.ForestStoreModel");
dojo.require("dijit.Toolbar");
dojo.require("dijit.form.Button");
dojo.require("dojo.cookie");

dojo.require("dojo.fx");
dojo.require("dojo.NodeList-fx");

console.log = air.Introspector.Console.log;

var docs = function(){
	this.config = {
		templateSettings: dojo.cache("templates", "settings.html"),
		templateInfo: dojo.cache("templates", "infobar.html"),
		templateQuickstart: dojo.cache("templates", "quickstart.html")
	}

	dojo.mixin(this, {
		activeFile: null
	});

	this.init();
	this.setupLayout();
	this.queryNodes();
	this.initTree();
	this.connectEvents();
}

docs.prototype.init = function(){
	// Start wizard if no preset is defined
	this.config.docRoot = dojo.cookie("docRoot");
	this.config.docIndex = dojo.cookie("docIndex");
	if (this.config.docRoot){
		return;
	}

	var tmpl = new dojox.dtl.Template(this.config.templateQuickstart);
	this.nodeQuickstart = dojo._toDom(tmpl.render(new dojox.dtl.Context({})));
	document.body.appendChild(this.nodeQuickstart);
}

docs.prototype.setupLayout = function(){
	// Init main layout
	this.bc = new dijit.layout.BorderContainer({
		"class": "container"
	}, dojo.byId("container"));

	// Left pane
	this.lp = new dijit.layout.ContentPane({
		region: "left",
		"class": "leftPane",
		splitter: "true"
	});
	this.bc.addChild(this.lp);

	// Right pane
	this.rp = new dijit.layout.TabContainer({
		region: "center",
		tabStrip: true
	});
	this.bc.addChild(this.rp);

	// Parse bottom template
	this.templateInfo = new dojox.dtl.Template(this.config.templateInfo);
	this.bp = new dijit.layout.ContentPane({
		region: "bottom",
		"class": "toolbar",
		splitter: "false",
		content: this.templateInfo.render(new dojox.dtl.Context({}))
	});
	this.bc.addChild(this.bp);

	// Add tabs
	this.sourceBc = new dijit.layout.BorderContainer({
		title: "Edit Source"
	});
	this.rp.addChild(this.sourceBc);

	// Toolbar
	this.toolbar = new dijit.Toolbar({
		region: "top",
		"class": "toolbar"
	});
	this.sourceBc.addChild(this.toolbar);

	// Toolbar buttons
	this.buttonSave = new dijit.form.Button({
		iconClass: "dijitEditorIcon dijitEditorIconSave",
		label: "Save"
	});
	this.toolbar.addChild(this.buttonSave);

	this.buttonBuild = new dijit.form.Button({
		iconClass: "dijitEditorIcon dijitEditorIconTabIndent",
		label: "Build docs"
	});

	this.toolbar.addChild(this.buttonBuild);

	this.buttonPreview = new dijit.form.Button({
		iconClass: "dijitEditorIcon dijitEditorIconFullScreen",
		label: "Preview docs"
	});

	this.toolbar.addChild(this.buttonPreview);

	this.source = new dijit.layout.ContentPane({
		region: "center",
		content: '<textarea class="editor" id="editor"></textarea>'
	});
	this.sourceBc.addChild(this.source);

	this.log = new dijit.layout.ContentPane({
		region: "bottom",
		splitter: "true",
		"class": "console"
	});
	this.sourceBc.addChild(this.log);

	// Parse settings template
	var
		template = new dojox.dtl.Template(this.config.templateSettings),
		context = new dojox.dtl.Context({})
	;
	this.settings = new dijit.layout.ContentPane({
		title: "Settings",
		content: template.render(context)
	});
	this.rp.addChild(this.settings);

	this.bc.startup();
}

docs.prototype.queryNodes = function(){
	this.editor = dojo.byId("editor");
	this.nlDocRoot = dojo.query(".docRoot");
	this.nlDocIndex = dojo.query(".docIndex");
	this.nlPreviewDocRoot = dojo.query(".previewDocRoot");
	this.nlPreviewDocIndex = dojo.query(".previewDocIndex");
	this.nlSettingsSave = dojo.query(".settingsSave");
	this.nlSettingsDocIndex = dojo.query(".settingsDocIndex");
	this.nlError = dojo.query(".error");
}

docs.prototype.connectEvents = function(){
	dojo.connect(this.buttonSave, "onClick", this, function(){
		if (this.activeFile){
			var stream = new air.FileStream();
			stream.open(this.activeFile, air.FileMode.WRITE);
			stream.writeMultiByte(this.editor.value, air.File.systemCharset);
			stream.close();
		}
	})

	dojo.connect(this.buttonBuild, "onClick", this, function(){
		if(air.NativeProcess.isSupported){
			var
				info = new air.NativeProcessStartupInfo(),
				file = air.File.applicationDirectory.resolvePath("exec/make.sh"),
				args = new runtime.Vector["<String>"](),
				process = new air.NativeProcess(),
				logStr = "",
				that = this
			;

			info.arguments = args;
			info.executable = file;

			args.push(this.config.docRoot);

			process.addEventListener(air.ProgressEvent.STANDARD_OUTPUT_DATA, function(e) {
				logStr += process.standardOutput.readUTFBytes(process.standardOutput.bytesAvailable)+"<br />";
				that.log.attr("content", logStr);
			});

			process.addEventListener(air.NativeProcessExitEvent.EXIT, function(e) {
				if (e.exitCode == 0) {
					console.log("done");
				} else {
					console.log("error", e);
				}
			});

			process.start(info);
		}
	})

	dojo.connect(this.buttonPreview, "onClick", this, function(){

		var init = new air.NativeWindowInitOptions();

		init.minimizable = true;
		init.maximizable = true;
		init.resizable = true;

		// Manually set docIndex if it doesn't exist
		if (!this.config.docIndex){
			this.config.docIndex = this.config.docRoot+"/build/html/index.html";
		}

		var
			docs = air.File.applicationDirectory.resolvePath(this.config.docIndex),
			bounds = new air.Rectangle((air.Capabilities.screenResolutionX - 900) / 2, (air.Capabilities.screenResolutionY - 700) / 2, 900, 700),
			win = air.HTMLLoader.createRootWindow(true, init, true, bounds)
		;

		win.load( new air.URLRequest(docs.url) );
	});

	// Connect settings buttons
	this.nlDocRoot.onclick(this, function(){
		var
			file = air.File.documentsDirectory,
			filters = [],
			that = this
		;

		filters.push(new air.FileFilter("HTML Files", "*.html"));
		filters.push(new air.FileFilter("HTML Files", "*.htm"));
		file.addEventListener(air.Event.SELECT, function(e){
			that.config.docRoot = file.nativePath;
			dojo.cookie("docRoot", that.config.docRoot);
			// Check whether we have a build/index.html, otherwise show the
			// docIndex setting pane.
			var fileChk = air.File.applicationDirectory.resolvePath(that.config.docRoot+"/build/html/index.html");
			if (!fileChk.exists){
				that.nlSettingsDocIndex.wipeIn({
					beforeBegin: function(n){
						dojo.removeClass(n, "displayNone");
						dojo.style(n, "height", "0");
					},
					onEnd: function(){
						that.settingsDocIndexVisible = true;
					}
				}).play();
			}else{
				that.config.docIndex = that.config.docRoot+"/build/html/index.html";
				dojo.cookie("docIndex", that.config.docIndex);
				if (that.settingsDocIndexVisible){
					that.nlSettingsDocIndex.wipeOut({
						onEnd: function(){
							that.settingsDocIndexVisible = false;
						}
					}).play();
				}
			}
			that.nlPreviewDocRoot.attr("innerHTML", file.nativePath);
			that.initTree();
		})
		file.browseForDirectory("Where is the documentation root?");
	});

	this.nlDocIndex.onclick(this, function(){
		var
			file = air.File.documentsDirectory,
			filters = [],
			that = this
		;

		filters.push(new air.FileFilter("HTML Files", "*.html"));
		filters.push(new air.FileFilter("HTML Files", "*.htm"));
		file.addEventListener(air.Event.SELECT, function(e){
			that.config.docIndex = file.nativePath;
			dojo.cookie("docIndex", that.config.docIndex);
			that.nlPreviewDocIndex.attr("innerHTML", file.nativePath);
		})
		file.browseForOpen(file, filters);
	});

	this.nlSettingsSave.onclick(this, function(){
		if (!this.config.docRoot){
			this.nlError.query("> span").attr("innerHTML", "Please make sure you have your doc directory selected");
			this.nlError.wipeIn({
				beforeBegin: function(n){
					dojo.removeClass(n, "displayNone");
				},
				onEnd: function(){
					this.errorVisible = true;
				}
			}).play()
			return;
		}else if (this.errorVisible){
			this.nlError.attr("innerHTML", "Please make sure you have your doc directory selected").wipeOut().play()
		}

		if (!this.config.docIndex){
			alert("You have not set a doc index. This might be because you have not yet build your docs for the first time.");
		}

		dojo.fadeOut({
			node: this.nodeQuickstart,
			onEnd: function(n){
				dojo.addClass(n, "displayNone")
			}
		}).play();
	})
}

docs.prototype.initTree = function(){
	if (!this.config.docRoot){
		return;
	}

	// Destroy previous tree
	if (this.tree){
		this.tree.destroy();
		this.model.destroy();
	}

	var fileList = {
		identifier: "path",
		label: "name",
		items: this.readDirectory(this.config.docRoot+"/source")
	};

	this.store = new dojo.data.ItemFileReadStore({
		data: fileList
	});

	this.model = new dijit.tree.ForestStoreModel({
		rootId: "documents",
		rootLabel: "Documents",
		childrenAttrs: ["children"],
		store: this.store
	});

	this.tree = new dijit.Tree({
		model: this.model
	});

	var that = this;
	dojo.connect(this.tree, "onClick", this, function(item){
		var isFolder = that.store.getValue(item, "folder");
		if (!isFolder){
			this.activeFile = air.File.applicationDirectory.resolvePath(that.store.getValue(item, "path"));
			var stream = new air.FileStream();
			var data = "";

			stream.addEventListener(air.ProgressEvent.PROGRESS, function(e){
				data += stream.readMultiByte(stream.bytesAvailable, air.File.systemCharset);
				if (e.bytesLoaded == e.bytesTotal){
					stream.close();
					document.getElementById("editor").value = data;
				}
			});

			stream.openAsync(this.activeFile, air.FileMode.READ);
		}
	});

	this.lp.attr("content", this.tree.domNode);
}

docs.prototype.readDirectory = function(folder){
	//the current folder object
	var currentFolder = new air.File(folder);

	//the current folder's file listing
	var files = currentFolder.getDirectoryListing();

	var fileData = [];

	//iterate and put files in the result and process the sub folders recursively
	for (var f=0, l=files.length; f<l; f++){
		if (files[f].isDirectory){
			if (files[f].name !="." && files[f].name !=".." && files[f].name !=".svn" ){
				//it's a directory
				fileData.push({
					folder: true,
					name: files[f].name,
					path: files[f].nativePath,
					children: this.readDirectory(files[f].nativePath)
				})
			}
		}else{
			if (files[f].extension == "rst"){
				fileData.push({
					folder: false,
					extension: files[f].extension,
					path: files[f].nativePath,
					name:files[f].name
				});
			}
		}
	}
	return fileData;
}


dojo.ready(function(){
	new docs();
});