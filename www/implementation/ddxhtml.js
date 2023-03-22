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
	
// 1. NAMESPACES CONTRACTION
// =========================

	//if('transitionnal' != 'strict') {}		// TODO : Mode strict / transitionnal ? init options ?...

	const cleanNSRedundancy = (root = document.documentElement) => {
		root.querySelectorAll('*').forEach((el) => {	// clear unwanted useless xmlns
			if(el.getAttribute('xmlns') && el.parentElement.closest('[xmlns="' + el.getAttribute('xmlns')+'"]'))
				el.removeAttribute('xmlns');	// useless
			if(el.getAttribute('xmlns-0') && el.parentElement.closest('[xmlns-0="' + el.getAttribute('xmlns-0')+'"]'))
				el.removeAttribute('xmlns-0');	// useless
			if(el.getAttribute('xmlns-0') && !el.parentElement.closest('[xmlns-0]') && el.getAttribute('xmlns-0') == root.getAttribute('xmlns'))
				el.removeAttribute('xmlns-0');	// useless
		})
	}

	// override setters
	const nativeInnerHTMLSetter = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;

	Object.defineProperty(Element.prototype, 'innerXML', {
		get : function() {
			const cloned = this.cloneNode(true);
			NSExpansion(cloned.childNodes);
			return cloned.innerHTML;	// innerHTML getter = native.
		},
		set : nativeInnerHTMLSetter,	// innerXML setter = native innerHTML setter
	})

	Object.defineProperty(Element.prototype, 'innerHTML', {set: function(html) {
		try {
			nativeInnerHTMLSetter.call(this, html);
		} catch(err1) {
			try {
				const HTMLToXML = (html) => {
					const parser = new DOMParser();
					const doc = parser.parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><body>'+html+'</body></html>', 'text/html');	// let's fix HTML unclosed tags
					
					cleanNSRedundancy(doc.body);
					html = doc.body.innerHTML;		// innerHTML getter = native.
					
					const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
					const pattern = new RegExp(`<(${voidElements.join('|')})([^>]*?)(?<!/)>`, 'gi');
					return html.replace(pattern, '<$1$2 />');
				}
				nativeInnerHTMLSetter.call(this, HTMLToXML(html));
			} catch(err2) {
				return console.error(err2)
			}
			const msg = 'Valid HTML, but invalid XML. Automatically corrected for compatibility reasons.'
			var warn = new Error(msg), firstLineStack = false;
			warn.stack = err1.stack.split("\n");
			if(warn.stack[0].indexOf(err1.message) !== -1) {
				firstLineStack = warn.stack[0].replace(err1.message, msg);
				warn.stack.shift();
			}
			warn.stack.shift();	// One more, assuming the error is not inside this setter.
			if(firstLineStack)
				warn.stack.unshift(firstLineStack);
			warn.stack = warn.stack.join("\n")
			console.warn(warn);		// Chrome & Firefox OK. TODO : TEST OTHERS
		}
	}
	});

	const collectAncestors = (el, includingEl) => {
			var parents = [];
			var currentElement = el;
			while (currentElement.parentElement) {
				parents.push(currentElement.parentElement);
				currentElement = currentElement.parentElement;
			}
			parents.reverse();
			if(includingEl)
				parents.push(el);
			return parents;
	}

	const collectNSDefinitions = (el, contracted) => {
		var collectedNSs = {};
		for(parent of collectAncestors(el, true))
			for (const attribute of parent.attributes)
				if(attribute.nodeName.indexOf('xmlns') === 0){
					var nn = attribute.nodeName;
					if(nn == 'xmlns' || nn == 'xmlns-0')
						collectedNSs[(contracted) ? 'xmlns-0' : 'xmlns'] = attribute.nodeValue;
					else {
						var prefix = nn.substring(6);
						collectedNSs[(contracted) ? 'xmlns-' + prefix : 'xmlns:' + prefix];
					}
				}
		return collectedNSs;
	}

	const recreateElement = (el, newTagName, avoidAttributesCopy) => {
		const newtagOuterHTML = '<'+newTagName+'>' + el.innerHTML + '</'+newTagName+'>';
		const newTagContainer = document.createElement('div')
		if(newTagName.indexOf(':') > 0)
			try{
				newTagContainer.innerXML = newtagOuterHTML		// innerXML setter (= native innerHTML setter)
			} catch(e) {
				console.error(e)
				console.warn(newtagOuterHTML)
			}
		else
			newTagContainer.innerHTML = newtagOuterHTML		// innerXML setter (= native innerHTML setter)
		const newXML = newTagContainer.getElementsByTagName(newTagName)[0]
		if(!avoidAttributesCopy)
			for(const attr of el.attributes)
				newXML.setAttribute(attr.nodeName, attr.nodeValue)
		el.parentNode.replaceChild(newXML, el);
		if(typeof el.initialDOM != 'undefined')
			newXML.initialDOM = el.initialDOM;
		return newXML;
	}

	const NSContraction = (el = document.documentElement) => {
		cleanNSRedundancy(el)	// TODO : ne fonctionnera peut être pas : xmlns a un statut spécial quand le document est de type XML !!!
		const contractEl = (el) => {
			const nn = el.nodeName
			var attributesNodes = [];
			for(const attr of el.attributes)
				attributesNodes.push(attr)
			if( el.nodeName == 'template' || ![Node.DOCUMENT_TYPE_NODE, Node.DOCUMENT_NODE ].includes(el.parentNode.nodeType) ) {
			// template elements are likely to not already have a parentNode probably because they are not rendered immediately
				for(const attr of attributesNodes) {
					var ann = attr.nodeName;
					if(ann == 'xmlns')
						el.setAttribute('xmlns-0' ,attr.nodeValue)
					else
						el.setAttribute(ann.replace(':', '-') ,attr.nodeValue)
					if(ann.indexOf(':') > 0 || ann == 'xmlns')
						el.removeAttribute(ann)
				}
				if(nn.indexOf(':') > 0)
					el = recreateElement(el, nn.replace(':', '-'))
			}
			else {
				for(const attr of attributesNodes) {	// <html> tag uniquement
					var ann = attr.nodeName;
					el.setAttribute(ann.replace('xmlns:', 'xmlns-') ,attr.nodeValue)	// On garde xml:lang par exemple...
					if(ann.indexOf('xmlns:') === 0)
						el.removeAttribute(ann)
				}
			}
			return el;
		}
		var list = [];
		el.querySelectorAll('*').forEach((subEl) => {list.push(subEl)})
		list.reverse().push(el);
	console.log(list)
		let iterations = list.length;
		for(const _el of list)
			if(!--iterations)
				el = contractEl(_el)
			else
				contractEl(_el)
		el.querySelectorAll('*').forEach((subEl) => {subEl.removeAttribute('xmlns')})
	console.log('NSContraction on ', el)
		return el;
	}

	/*
	window.addEventListener('DOMContentLoaded', () => {
		console.log('window captured by DOMContentLoaded')
		NSContraction();
	}, true);
	*/

	const NSExpansion = (target = document.documentElement, collectedNSDefinitions) => {	// Retourne un clone de l'élément en XML standard
		if(Element.prototype.isPrototypeOf(target)) {
			if(!collectedNSDefinitions) {
				collectedNSDefinitions = collectNSDefinitions(target, false);
				recursion = false;
				target = target.cloneNode(true);
			}
			else
				recursion = true;
			
			var attributesNodes = [], newAttributes = {}
			
			for(const attr of target.attributes)
				attributesNodes.push(attr)
			for(const attr of attributesNodes) {
				var ann = attr.nodeName;
				if(ann.indexOf('-') > 0) {
					var prefix = ann.substring(0, ann.indexOf('-'))
					var tn = ann.substring(ann.indexOf('-') + 1)
					if(prefix != 'xmlns') {
						if(typeof collectedNSDefinitions['xmlns:'+prefix] != undefined)	// On ne touche que aux prefixed-attributes concernés par les NS
							newAttributes[prefix + ':' + tn] = attr.nodeValue;
						else
							newAttributes[ann] = attr.nodeValue;	// prefixed-attribute tel quel
					}
					else {
						if(ann == 'xmlns-0')
							newAttributes['xmlns'] = attr.nodeValue;		// On garde xmlns
						else
							newAttributes['xmlns:' + tn] = attr.nodeValue;		// On garde xmlns:tn
						target.removeAttribute(ann);	// On vire les xmlns-contracted et les xmlns-0
					}
				}
				else
					newAttributes[ann] = attr.nodeValue;	// non_prefixed_attribute tel quel
			}
			var nn = target.tagName;
			if(nn.indexOf('-') > 0) {
				var prefix = nn.substring(0, nn.indexOf('-'))
				if(typeof collectedNSDefinitions['xmlns:' + prefix] != undefined) {
					var tn = nn.substring(nn.indexOf('-') + 1)
					target = recreateElement(target, prefix + ':' + tn, true);	// true pour avoidAttributesCopy
				}
			}
			if(!recursion)
				for(const nsDef in collectedNSDefinitions)
					newAttributes[nsDef] = collectedNSDefinitions[nsDef];
			
			for(const attrName in newAttributes)
				target.setAttribute(attrName, newAttributes[attrName]);
			
			for(const el of target.children)
				NSExpansion(el, collectedNSDefinitions)

			return target;	// On retourne le clone.
		}
	}

	const nativeOuterHTMLGetter = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML').get;

	Object.defineProperty(Element.prototype, 'outerHTML', {get : function() {	// TODO : PEUT ETRE INUTILE. A VOIR APRES defineProperty 'namespaceURI'
		this.querySelectorAll('*').forEach((el) => {
			if(el.getAttribute('xmlns') == el.getAttribute('xmlns-0'))
				el.removeAttribute('xmlns');
		})
		if(this.getAttribute('xmlns') == this.getAttribute('xmlns-0'))
			this.removeAttribute('xmlns-0');	// keeping xmlns on first for XML consistancy.
		return nativeOuterHTMLGetter.call(this);	// outerHTML getter = native.
	} })

	Object.defineProperty(Element.prototype, 'outerXML', {get : function() {	// Return Clone
		return NSExpansion(this).outerHTML;	// outerHTML getter = almost native. (see just bellow)
	} })

	Object.defineProperty(Element.prototype, 'DOMPath', {get : function () {	 // From https://gist.github.com/karlgroves/7544592
		var stack = [], el = this;
		while (el.parentNode != null) {
	//console.log(el.nodeName);
			var sibCount = 0;
			var sibIndex = 0;
			for ( var i = 0; i < el.parentNode.childNodes.length; i++ ) {
				var sib = el.parentNode.childNodes[i];
				if ( sib.nodeName == el.nodeName ) {
					if ( sib === el ) {
						sibIndex = sibCount;
						break;
					}
					sibCount++;
				}
			}
			if(el.hasAttribute('id') && el.id != '')
				stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
			else if ( sibCount > 1 )
				stack.unshift(el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
			else
				stack.unshift(el.nodeName.toLowerCase());
			el = el.parentNode;
		}
		return stack.slice(1).join(' > '); // removes the html element + return string
	} })


// 2. XPath EVALUATION SIMPLIFIED
// ==============================

	const nativeEvaluate = Object.getOwnPropertyDescriptor(Document.prototype, 'evaluate').value;
	Object.defineProperty(Document.prototype, 'evaluate', {
		value: function(xpathExp, n = document.documentElement, NSResolver = null, resultType = null, result = null) {
		const parser = new DOMParser();
		if(NSResolver !== null)
			var doc = NSExpansion(n)
		else {
			//NSResolver = function(p){return 'http://www.w3.org/1999/xhtml';}
			var doc = parser.parseFromString('<html></html>', 'text/html');
			// prevent annoying parser auto correction that move unknownHTMLElement from head to body.
			// Due to insertion politic ?
			doc.head.innerHTML = this.head.innerHTML;
			doc.body.innerHTML = this.body.innerHTML;
			doc.documentElement.querySelectorAll('*').forEach((el) => {
				el.removeAttribute('xmlns')
			});
			doc.documentElement.removeAttribute('xmlns');
		}
		if(resultType == null)
			resultType = XPathResult.ANY_TYPE

		if(n == document.documentElement)
			n = doc.documentElement;
		else
			n = doc.querySelector(n.DOMPath);	// because Firefox needs n to belong to doc. And it's logical
		
		return nativeEvaluate.call(doc, xpathExp, n, NSResolver, resultType, result);	// TODO rehabiliter n
	}
	})

	const QueryXPath = function (exp) {
		var xpe = document.evaluate(exp, this), r = xpe.iterateNext();
		if(r instanceof Element)
			return document.querySelector(r.DOMPath);
		return r
	}
	const QueryXPathAll = function (exp) {
		var xpe = document.evaluate(exp, this), result = [];
		while (n = xpe.iterateNext())
			if(n instanceof Element)
				result.push(document.querySelector(n.DOMPath));
			else
				result.push(n);
		return result;
	}

	Element.prototype.QueryXPath = function(exp) { return QueryXPath.call(this, exp); };
	Document.prototype.QueryXPath = function(exp) { return QueryXPath.call(this.documentElement, exp); };
	Element.prototype.QueryXPathAll = function(exp) { return QueryXPathAll.call(this, exp); };
	Document.prototype.QueryXPathAll = function(exp) { return QueryXPathAll.call(this.documentElement, exp); };

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
	// Start observing the target node for configured mutations
	observer.observe(document, {
		attributes: true,
		childList: true,
		subtree: true,
		attributeFilter: Object.keys(attributesChangedCallbacks)
	});	// + attributeOldValue + characterData + characterDataOldValue
};

function forcePattern(field) {
	var R = new RegExp(field.getAttribute('pattern'));
	if(typeof field._lastValidValue == 'undefined')
		field._lastValidValue = field.defaultValue;
	if(R.test(field.value))
		field._lastValidValue = field.value;
	else
		field.value = field._lastValidValue;
}

ddxhtmlImplementation({
	'0.1': {
		templateEngines: {
			'text/x-handlebars': (source) => {return Handlebars.compile(source);}
		},
		editors: {
			'number' : (initialValue = '') => {return '<input part="editor" value="'+initialValue+'" pattern="^\d*\.?\d*$" inputmode="decimal" type="text" />';}
		},
		defaultBehaviors: (el) => {
			if(el.hasAttribute('edit-as')) {
				//var editorType = el.getAttribute('edit-as')
				var fieldWithPattern = el.shadowRoot.querySelector('[pattern]')
				if(fieldWithPattern)
					forcePattern(fieldWithPattern);
				
			}
			svg = el.shadowRoot.querySelector('svg[data-auto-viewbox]');
			if(svg) {
				var el = (svg.getAttribute('data-auto-viewbox')) ? svg.querySelector(svg.getAttribute('data-auto-viewbox')) : null;
				var bb = el.getBBox();
				svg.setAttribute('viewBox', bb.x + ' '+ bb.y + ' ' + bb.width + ' ' + bb.height);
				console.warn(svg.getAttribute('viewBox'))
			}
		},
		defaultCSS: ``,
		defaultXDSS: ``
	}
});
