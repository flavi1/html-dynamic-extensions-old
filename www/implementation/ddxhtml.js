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

// 3. DESIGN LAYER
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
			var refEl = getReferencedDataElement(el), initialValue = '';
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
				var refEl = getReferencedDataElement(el)
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

// 4. DATA LAYER
// =============

	const getReferencedDataElement = (el) => {
			// parents group-by ?
			// parents each-item + at attribute ?
			// model ? instance ?
		
		var XPathExp = '//';
		
		var model = null;
		if(el.closest('[model]'))
			model = getElementById(el.closest('[model]').getAttribute('model'))
		if(!model)
			model = document.querySelector('head model');
	//console.log('model', model)
		for(upperEl of collectAncestors(el)) {
			//console.log('XPATH UPPER', upperEl)
			if(upperEl.getAttribute('group-by'))
				XPathExp += upperEl.getAttribute('group-by')+'/';
		}
		XPathExp += el.getAttribute('ref')
		if(el.getAttribute('at'))
			XPathExp += '[' + el.getAttribute('at') + ']';
/*
		if(model.QueryXPath(XPathExp)) {
			console.log('XPATH EXP : ', XPathExp, 'for', el)
			console.log('XPATH RESULT : ', model.QueryXPath(XPathExp));
		}
*/
		return model.QueryXPath(XPathExp);
	}


// 5. DYNAMIC BEHAVIOR
// ===================

	const refreshContent = function() {
		if(!this.getAttribute('ref') && !this.getAttribute('each-item') && !this.getAttribute('render-by'))
			return;
		if(!this.initialDOM) {
			this.initialDOM = this.innerHTML;
			this.querySelectorAll('itemset, actions').forEach((settingEl) => {
				addElementSettings(settingEl);
			})
		}
		if(this.getAttribute('each-item'))	// TODO
			return;
		var value = null;
		var result = '';
		if(this.getAttribute('ref')) {
			ReferencedEl = getReferencedDataElement(this);
			if(ReferencedEl)
				value = ReferencedEl.innerXML;
			else
				value = this.innerXML;
			// + sinon : value = this.innerHTML;
		}
		else
			value = this.innerHTML;
		
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
		else
			result = value;
		
		if(result == null)
			result = '';
		if(this.innerHTML.trim() !== result.trim()) {
			observationEnabled = false;
				this.innerXML = result;
			observationEnabled = true;
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
		observationEnabled = false;
			settingEl.remove(); // we doesn't need it anymore
		observationEnabled = true;
		
		console.log(el.innerDOMSettings)
	}



// 6. MUTATION OBERVER ( = THE CORE)
// =================================

	var observationEnabled = true;

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
				document.querySelectorAll('body *[ref], body *[each-item], body *[render-by]').forEach((el) => {el.refreshContent();})
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
		if(!observationEnabled)
			return;
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

	NSContraction();
	if(designSystem['defaultCSS']) {
		const defaultStyle = document.createElement('style');
		defaultStyle.appendChild(document.createTextNode(designSystem['defaultCSS']));
		document.head.prepend(defaultStyle)
	}
	// Start observing the target node for configured mutations
	observer.observe(document, {
		attributes: true,
		childList: true,
		subtree: true,
		attributeFilter: Object.keys(attributesChangedCallbacks)
	});	// + attributeOldValue + characterData + characterDataOldValue
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
}`,
		defaultXDSS: ``
	}
});

/*
window.addEventListener('DOMContentLoaded', () => {
	console.log('window captured by DOMContentLoaded')
	NSContraction();
}, true);
*/
