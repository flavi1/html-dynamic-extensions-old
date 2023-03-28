const ddxhtmlImplementation = (supportedDesignSystems) => {

	if(!document.documentElement.hasAttribute('dsv')) {
		console.warn('Assuming this is a classical XHTML document because dsv attribute is not set on the html root element.');
		// or => implementation without design system feature? 
	}
	else {
		var designSystemVersion = document.documentElement.getAttribute('dsv');
		if(typeof supportedDesignSystems[designSystemVersion] !== 'undefined')
			var designSystem = supportedDesignSystems[designSystemVersion];
		else {
			console.error('Design system version ' + designSystemVersion + ' not supported');
			return;
		}
			
	}

// 1. DESIGN LAYER
// ===============

	document.designSheets = [];

	// Pour plus de consistance, on s'inspirera peut-être de Document.styleSheets (see https://developer.mozilla.org/fr/docs/Web/API/Document/styleSheets)
	// For now, it's just a POC
	// on prendra en compte les title pour la gestion de thèmes. (opt)
	document.designSheets.add = (url, opt) => {
		fetch(url)
			.then(response => response.text())
			.then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
			.then((xml) => {
				var err = xml.querySelector('parsererror')	// TODO : find a cross-browser way to extract parseerror information.
				if(err)
					throw new Error(url + ' is not a valid XDSS file.');
				else if(xml.childNodes[0].nodeName == 'design') {
					document.designSheets.push({
						url: url,
						XDSSRulesList : xml.childNodes[0].querySelectorAll('template')
					})
					document.designSheets.refreshAll();
				}
				else
					throw new Error(url+' is not a valid XDSS file.');
			})
			.catch(err => console.error(err.message));
	}

	const getTemplate = (source, type = null) => {
		if(!type) {/* TODO use default html template engine */
				// browser support ? => 'content' in document.createElement('template')
				return;
			}
		if(typeof designSystem.templateEngines[type] == 'function')
			return designSystem.templateEngines[type](source);
	}
	
	const defaultEditors = {
		'string': (initialValue = '') => {return '<input part="editor-string" type="text" value="'+initialValue+'" />';}
	}
	
	const wrapDesign = (el, html) => {
		var editor = '', editorType = 'null';
		
		if(el.hasAttribute('edit-as')) {
			editorType = el.getAttribute('edit-as');
			var refEl = getModel(el).QueryXPath(makeXPathExp(el)), initialValue = '';
			if(refEl && refEl instanceof Element)
				initialValue = refEl.innerHTML;
			
			if(typeof designSystem.editors[editorType] == 'function')
				editor = designSystem.editors[editorType](initialValue)		// TODO transmettre initialValue + contraintes "bind"
			else if(typeof defaultEditors[editorType] == 'function')
				editor = defaultEditors[editorType](initialValue);
			else
				editor = '<input part="editor-string" type="text" value="'+initialValue+'" />';
		}
		
		return '<div part="editor">' + editor + '</div><div part="design">'+html+'</div>';
	}
	
	const applyDSBehaviors = (el) => {
		if(!el.shadowRoot)
			return;
		var input = el.shadowRoot.querySelector('input');
		if(input) {
			var listener = (ev) => {
				console.log('VALUE', ev.target.value)
				var refEl = getModel(el).QueryXPath(makeXPathExp(el))
				if(refEl && refEl instanceof Element && refEl.innerHTML !== ev.target.value)
					refEl.innerXML = ev.target.value;
					console.log(refEl)
			}
			input.addEventListener('change', listener)
			if(el.getAttribute('incremental') == 'true')
				input.addEventListener('input', listener)
			input.addEventListener('blur', listener)
		}
		designSystem.defaultBehaviors(el);
	}
	
	const refreshDesign = function(subTree) {
		// TODO : exclude this if matches something for performance
		document.designSheets.forEach((ds) => {
			ds.XDSSRulesList.forEach((rule) => {
				const sel = rule.getAttribute('selector')
				if(!this.matches(sel))
					return;
				const stylesToObserve = rule.getAttribute('style-sensitivity').split(",").map(s => s.trim());
				if(typeof this._lastTplVars == 'undefined')
					this._lastTplVars = {};
				const template = getTemplate(rule.textContent, rule.getAttribute('type'));
				try {
					if(!this.shadowRoot)
						this.attachShadow({ mode: "open" })
				} catch(err) {
					console.error('Design layer unable to attach shadow DOM on Element', this);
					console.warn('Please considere to use one of theses tags instead of the ' + this.tagName+' tag.', 'article, aside, blockquote, body, div, footer, h1, h2, h3, h4, h5, h6, header, main, nav, p, section, span'.split(',').map(item => item.trim()));
				}
				if(this.shadowRoot) {
					const CStyles = getComputedStyle(this);
					var tplVars = {
						'attributes' : {},
						'styles' : {},
						'textContent' : this.textContent,
						'innerHTML' : this.innerHTML,
						'innerXML' : this.innerXML,
					}
					for(const a of this.attributes)
						tplVars.attributes[a.name] = a.value;
					for(const s of stylesToObserve)
						tplVars.styles[s] = CStyles.getPropertyValue(s);
					if(this._lastTplVars != tplVars) {
						var result = template(tplVars).trim(), designPart = this.shadowRoot.querySelector('[part="design"]')

// TODO : ADD FOCUS CONDITION

						if(!designPart || !this.shadowRoot.activeElement) {	// redraw all
							result = wrapDesign(this, result);
							if(this.shadowRoot.innerHTML.trim() != result)
								this.shadowRoot.innerHTML = result;
//console.warn(designPart, result);
						}
						else { // update design
							if(designPart.innerHTML.trim() != result)
								designPart.innerXML = result;
						}
						this._lastTplVars = tplVars;
					}
					const event = new Event("refreshDesign");
					applyDSBehaviors(this);
					this.dispatchEvent(event);
				}


			})
		})
		if(subTree)
			this.querySelectorAll('*').forEach((c) => {	// = flattened childNodes
				c.refreshDesign();
			})
	};
	Element.prototype.refreshDesign = function(subTree) { return refreshDesign.call(this, subTree); };


	document.designSheets.refreshAll = () => {
		document.designSheets.forEach((ds) => {
			ds.XDSSRulesList.forEach((rule) => {
				const sel = rule.getAttribute('selector')
				document.querySelectorAll(sel).forEach((el) => {
					el.refreshDesign();
				})
			})
		})

		const event = new Event("refreshDesign");
		document.dispatchEvent(event);
	}

// 2. DATA LAYER
// =============
	
	const getModel = (el) => {
		var model = null
		if(el.closest('[model]'))
			model = document.getElementById(el.closest('[model]').getAttribute('model'))
		if(!model)
			return document.querySelector('head model');
		return model;
	}
	
	const makeXPathExp = (el) => {
		var XPathExp = '/';
		if(el.getAttribute('ref'))
			targetAttr = 'ref'
		else if(el.getAttribute('set'))
			targetAttr = 'set'
		else if(el.getAttribute('shown'))
			targetAttr = 'shown'

		for(upperEl of collectAncestors(el, true))
			if(upperEl.getAttribute('each-item') || upperEl.getAttribute('group-by') || upperEl.getAttribute(targetAttr) ){
				if(upperEl.getAttribute('at'))
					XPathExp += '['+upperEl.getAttribute('at')+']/';
				else
					XPathExp += '/'
				if(upperEl.getAttribute('each-item'))
					XPathExp += upperEl.getAttribute('each-item');
				if(upperEl.getAttribute('group-by'))
					XPathExp += upperEl.getAttribute('group-by');
				if(upperEl.getAttribute(targetAttr))
					XPathExp += upperEl.getAttribute(targetAttr);
			}
		return XPathExp;
	}
	
	const getReferencedDataElement = (el, byAttr = 'ref') => {

		var model = getModel(el),
			XPathExp = makeXPathExp(el)

		if(byAttr == 'shown')
			return document.evaluate(XPathExp, model).booleanValue;
		if(byAttr == 'each-item')
			return model.QueryXPathAll(makeXPathExp(el));
		return model.QueryXPath(makeXPathExp(el));
	}

// 3. DYNAMIC BEHAVIOR
// ===================
	
	var initialDOMContents = {}
	
	Object.defineProperty(Element.prototype, 'initialDOM', {
		get : function() {
			if(typeof initialDOMContents[this.DOMPath] != 'undefined')
				return initialDOMContents[this.DOMPath];
		}
	})

	const refreshContent = function(preventObserver = false) {
		if(!this.isConnected)
			return;
		if(!this.getAttribute('ref') && !this.getAttribute('each-item') && !this.getAttribute('render-by'))
			return;
		if(typeof initialDOMContents[this.DOMPath] == 'undefined') {
			initialDOMContents[this.DOMPath] = this.innerHTML;
console.log('this.initialDOM = ', this.initialDOM)
			this.querySelectorAll('itemset, actions').forEach((settingEl) => {
				addElementSettings(settingEl);
			})
		}
		
		var value = null;
		var result = '';
		
		if(this.getAttribute('each-item')) {
			
console.log('EACH-ITEM on',this)
			
			var items = getModel(this).QueryXPathAll(makeXPathExp(this))
			
			var newItemTpl = document.createElement('div'), closestRefsOrGRefs = [], closestRefsOrGRefs = [];
			newItemTpl.innerHTML = this.initialDOM;
			newItemTpl.querySelectorAll(':scope [ref], :scope [group-ref]').forEach((el) => {
				closestRefsOrGRefs.push(el.closest('[ref], [group-ref]'));
			});
			for (var index = 0; index < items.length; index++) {
				for(const el of closestRefsOrGRefs)
					if(el.setAttribute('at', index + 1))
				console.log(newItemTpl.innerHTML)
				result += newItemTpl.innerHTML
			}
		}
		else if(this.getAttribute('ref')) {
			ReferencedEl = getModel(this).QueryXPath(makeXPathExp(this));
			if(ReferencedEl)
				value = ReferencedEl.innerXML;
			else
				value = this.innerXML;
			// + sinon : value = this.innerHTML;
		}
//		else
//			value = this.innerHTML;
		
		if(this.getAttribute('render-by')) {
			const tid = this.getAttribute('render-by')
			const srcEl = document.querySelector('template#'+tid+', script#'+tid)	// script tolerance type="template" for possible use in (non xml) html sytax
			if(srcEl) {
				const tplVars = {
					value: value,
					settings: (this.innerDOMSettings && innerDOMSettings.itemset) ? innerDOMSettings.itemset : null
				}
				var template = getTemplate(srcEl.textContent, srcEl.getAttribute('type'));
				result = template(tplVars);
			}
		}
		else if(this.innerDOMSettings && this.innerDOMSettings.itemset && typeof this.innerDOMSettings.itemset[value] != 'undefined')
			result = this.innerDOMSettings.itemset[value];
		else if(this.getAttribute('ref'))
			result = value;
		
		if(result == null)
			result = '';
		if(this.innerHTML.trim() !== result.trim()) {
			if(!preventObserver) pauseObserver();
				this.innerXML = result;
				this.querySelectorAll('*').forEach((el) => {
					el.refreshContent(true);
				})
			if(!preventObserver) playObserver();
			
			this.refreshDesign();		// TODO : Semble ne pas fonctionner, ou pas immédiatement...
		}
		
	}
	Element.prototype.refreshContent = function() { return refreshContent.call(this); };

	const addElementSettings = (settingEl) => {
		console.log('innerDOMSettings')
		
		el = settingEl.parentNode;
		if(!el.innerDOMSettings)
			el.innerDOMSettings = {}
		switch(settingEl.tagName) {
			case 'itemset':
				if(!el.innerDOMSettings.itemset)
					el.innerDOMSettings.itemset = {}
				settingEl.querySelectorAll('item').forEach((item) => {
					const v = item.querySelector('value').innerHTML	// TODO : is value should be able to be XML/HTML content ?
					el.innerDOMSettings.itemset[v] = item.querySelector('label').innerHTML	;	// Naturally, Ok for labels.
				})
			break;
			case 'actions':
				if(!el.innerDOMSettings.itemset)
					el.innerDOMSettings.itemset = {}
				// TODO : prepare settings + addEventListeners.
			break;
		}
		pauseObserver();
			settingEl.remove(); // we doesn't need it anymore
		playObserver()
		
		console.log(el.innerDOMSettings)
	}

// 4. MUTATION OBERVER ( = THE CORE)
// =================================

//var observationEnabled = true;

	const nodesCallbacks = {
		'link[rel="designsheet"]' : (el, action) => {
			console.log(action + ' designsheet', el)
			document.designSheets.add(el.getAttribute('href'))
		},
		'link[rel="stylesheet"], style' : (el, action) => {
			console.log(action + ' stylesheet', el)
			document.designSheets.refreshAll();
		},
		'head model, head model *' : (el, action) => {
			console.log(action + ' data layer', el)
			if(action == 'change')
				document.querySelectorAll('body *[ref], body *[each-item], body *[render-by], body *[shown]').forEach((el) => {
					if(el.getAttribute('shown'))
						el.hidden = !document.evaluate(makeXPathExp(el)).booleanValue;
					el.refreshContent();
				})
		},
		'template' : (el, action) => {
			document.querySelectorAll('body [render-by="' + el.id + '"]').forEach((elToRender) => {
				elToRender.refreshContent();	// Et c'est tout.
			});
		},
		'body, body *' : (el, action) => {
			console.log(action + ' main flow', el)
			
			const mainFlow = function() {
				if(this.matches('body *[ref] > itemset, t > actions'))
					addElementSettings(this);
				else if(this.getAttribute('ref') || this.getAttribute('each-item') || this.getAttribute('render-by'))
					this.refreshContent();
				if(this.getAttribute('shown'))
					this.hidden = !document.evaluate(makeXPathExp(this)).booleanValue;		//!getReferencedDataElement(this, 'shown');
			}
			
			mainFlow.call(el);
			el.querySelectorAll('*').forEach((subEl) => {	// flattened childrenElements
				mainFlow.call(subEl);
			});
		}
	}

	const attributesChangedCallbacks = {
		'style' : (el, value) => {
			console.log('ATTR style changed', el, value)
			el.refreshDesign(true);
		}
	}

	// Create an observer instance linked to the callback function
	const observer = new MutationObserver((mutationList, observer) => {
//		if(!observationEnabled)
//			return;
		var action = '', nodes = [], nodesCB = [], lastAddedNode = null;
		
		mutationList.forEach((mutation) => {
			switch (mutation.type) {
			  case "childList":
			  
				   nodesCB = nodesCallbacks;
				   
				   if(mutation.addedNodes.length) 
						nodes = mutation.addedNodes
				   else
						nodes = mutation.removedNodes;

				   nodes.forEach(function(el) {
						Object.keys(nodesCB).forEach(sel => {
							if(el.nodeType == Node.TEXT_NODE && el.parentNode && el.parentNode.matches instanceof Function && el.parentNode.matches(sel) && el.parentNode != lastAddedNode) {
								nodesCB[sel](el.parentNode, 'change', el, action);
							}
							else if(el.nodeType == Node.ELEMENT_NODE && el.matches instanceof Function && el.matches(sel))
								if(mutation.addedNodes.length) {
									el = NSContraction(el)
									lastAddedNode = el
									nodesCB[sel](el, 'add');
								}
								else
									nodesCB[sel](el, 'remove');
						});
					})
					
				   if(nodes.length)
						document.designSheets.forEach((ds) => {
						   console.log('!!! DS : ', ds)
						   // feed nodesCB
						})
					
				break;
			  case "attributes":
				   if(attributesChangedCallbacks[mutation.attributeName] instanceof Function)
						attributesChangedCallbacks[mutation.attributeName](mutation.target, mutation.target.getAttribute(mutation.attributeName))
				break;
			}
		})
	console.groupEnd();
	});
	
	const observeOneTime = (el = document) => {
		initElements = []
		document.querySelectorAll('*').forEach((el) => {
			initElements.push(el)
		})
		for(const el of initElements)
			Object.keys(nodesCallbacks).forEach(sel => {
				if(el.nodeType == Node.ELEMENT_NODE && el.matches instanceof Function && el.matches(sel))
					nodesCallbacks[sel](el, 'add');
			})
	}
	
	const playObserver = () => {
		observer.observe(document, {
			attributes: true,
			childList: true,
			subtree: true,
			attributeFilter: Object.keys(attributesChangedCallbacks)
		});	// + attributeOldValue + characterData + characterDataOldValue
	}
	
	const pauseObserver = () => {
		observer.disconnect();
	}

	if(designSystem['defaultCSS']) {
		const defaultStyle = document.createElement('style');
		defaultStyle.appendChild(document.createTextNode(designSystem['defaultCSS']));
		document.head.prepend(defaultStyle)
	}
	
	const hookAnchorClicked = (a) => {
		console.log('a[target="_hooks"] clicked !')
		console.log(a, a.getAttribute('href'));
	}

	const triggerElementClicked = (t) => {
		actions = [];
		console.log('trigger Element clicked')
		console.log(t);
		
		var oneAction = {
			'ref' : t.getAttribute('ref'),		// ref, nodeset, ou les deux?
			'at' : t.getAttribute('at'),
			'nodeset' : t.getAttribute('nodeset'),
			'value' : t.getAttribute('value')
		}
		for(const attr of t.attributes)
			if(['set', 'sendby', 'action'].includes(attr.nodeName)) {
				if(attr.nodeName == 'set') {
					oneAction.type = 'set'
					oneAction.ref = attr.nodeValue
				}
				else if(attr.nodeName == 'sendby') {
					oneAction.type = 'send'
					oneAction.by = attr.nodeValue
				}
				else if(attr.nodeName == 'action' && ['delete', 'reset'].includes(attr.nodeValue) )
					oneAction.type = attr.nodeValue
			}
		if(oneAction.type)
			actions.push(oneAction)
		const manyActions = t.querySelector('actions > *');
		if(!oneAction.type && manyActions)
				manyActions.forEach((action) => {
					if(['insert', 'set', 'send', 'delete', 'reset'].includes(action.nodeName))
						actions.push({
							'type' : action.nodeName,
							'value' : action.innerHTML,
							'nodeset' : action.getAttribute('nodeset'),
							'position' : action.getAttribute('position'),
							'at' : action.getAttribute('at'),
							'by' : action.getAttribute('by'),	// (send by submission id)
							'ref' : action.getAttribute('ref')
						});
				})
		for(const act of actions)
			switch (act.type){
				case 'set':
					var exp = makeXPathExp(t)
					console.log(exp)
					var target = getModel(t).QueryXPath(exp)
					target.innerHTML = act.value
				break;
			}
		
	}
	
	window.addEventListener('DOMContentLoaded', () => {
		console.log('window captured by DOMContentLoaded')
		
		NSContraction();
		
		observeOneTime();
		playObserver();
		
		document.body.addEventListener("click", (ev) => {
			if (ev.target.nodeName === 't' && !ev.defaultPrevented) {
				// EXPECTED BEHAVIOR
				triggerElementClicked(ev.target);
			}
			if (ev.target.nodeName === 'a' && ev.target.getAttribute('target') == '_hooks' && !ev.defaultPrevented) {
				// EXPECTED BEHAVIOR
				hookAnchorClicked(ev.target)
				ev.preventDefault();
			}
		});
	}, true);
	
};

function forcePattern(ev) {
	const R = new RegExp(ev.target.getAttribute('pattern'));
	if(typeof ev.target._lastValidValue == 'undefined')
		ev.target._lastValidValue = ev.target.defaultValue;
	if(R.test(ev.target.value))
		ev.target._lastValidValue = ev.target.value;
	else
		ev.target.value = ev.target._lastValidValue;
}

ddxhtmlImplementation({
	'0.1': {
		templateEngines: {
			'text/x-handlebars': (source) => {return Handlebars.compile(source);}
		},
		editors: {
			// ^[0-9]+([\.,][0-9]*)?$		=> . et ,
			'number' : (initialValue = '') => {return '<input part="editor" value="'+initialValue+'" pattern="^[0-9]+([\.][0-9]*)?$" inputmode="decimal" type="text" />';}
		},
		defaultBehaviors: (el) => {
			if(el.hasAttribute('edit-as')) {
				//var editorType = el.getAttribute('edit-as')
				var fieldWithPattern = el.shadowRoot.querySelector('[pattern]')
				if(fieldWithPattern)
					fieldWithPattern.addEventListener('input', forcePattern)
			}
			svg = el.shadowRoot.querySelector('svg[data-auto-viewbox]');
			if(svg) {
				var el = (svg.getAttribute('data-auto-viewbox')) ? svg.querySelector(svg.getAttribute('data-auto-viewbox')) : null;
				var bb = el.getBBox();
				svg.setAttribute('viewBox', bb.x + ' '+ bb.y + ' ' + bb.width + ' ' + bb.height);
				console.warn(svg.getAttribute('viewBox'))
			}
		},
		defaultCSS: `
::part(design), ::part(editor) {
	display: inline-block;
}

*[edit-as]::part(design) {
	display: none;
}

t > actions {
	display: none;
}

t {
    appearance: button;
    overflow: visible;
    text-transform: none;
    border: 0;
    border-radius: 0.25rem;
    background: buttonface;
    font-family: system-ui, sans-serif;
    font-size: 1rem;
    line-height: 1.2;
    white-space: nowrap;
    text-decoration: none;
    padding: 0.25rem 0.5rem;
    margin: 0.25rem;
    cursor: pointer;
    border-width: 1px;
    border-style: outset;
    border-color: buttonborder;
    display: inline-block;
    text-align: center;
}
`,
		defaultXDSS: ``
	}
});
