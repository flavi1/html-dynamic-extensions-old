// 1. NAMESPACES CONTRACTION
// =========================

//if('transitionnal' != 'strict') {}		// TODO : Mode strict / transitionnal ? init options ?...

const cleanNSRedundancy = (root = document.documentElement) => {
	root.querySelectorAll('*').forEach((el) => {	// clear unwanted useless xmlns
		if(el.getAttribute('xmlns') && el.parentElement.closest('[xmlns="' + el.getAttribute('xmlns')+'"]'))
			el.removeAttribute('xmlns');	// useless
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

const NSExpansion = (target = document.documentElement, collectedNSDefinitions) => {	// Retourne un clone de l'élément en XML standard, ou transforme une nodeList (sans rien retourner)
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

Object.defineProperty(Element.prototype, 'outerXML', {get : function() {
	//const cloned = this.cloneNode(true);
	return NSExpansion(this).outerHTML;	// outerHTML getter = almost native. (see just bellow)
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
		var doc = parser.parseFromString(n.outerHTML, 'text/html').documentElement;	// outerHTML getter = native.
		doc.querySelectorAll('*').forEach((el) => {
			el.removeAttribute('xmlns')
		});
		doc.removeAttribute('xmlns');
	}
	if(resultType == null)
		resultType = XPathResult.ANY_TYPE
	return nativeEvaluate.call(this, xpathExp, doc, NSResolver, resultType, result);
}
})

const QueryXPath = function (exp) {
	var xpe = document.evaluate(exp, this), r = xpe.iterateNext();
	return r;
}
const QueryXPathAll = function (exp) {
	var xpe = document.evaluate(exp, this), result = [];
	while (n = xpe.iterateNext())
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

document.designSheets.refreshAll = () => {
	document.designSheets.forEach((ds) => {
		ds.XDSSRulesList.forEach((rule) => {
			const sel = rule.getAttribute('selector')
			const stylesToObserve = rule.getAttribute('style-sensitivity').split(",").map(s => s.trim());
			var template = null;
			if(rule.getAttribute('type') == 'text/x-handlebars')
				template = Handlebars.compile(rule.textContent)
			else {/* TODO use default html template engine */}
			document.querySelectorAll(sel).forEach((el) => {
				el._lastTplVars = {};
				el.refreshDesign = (subTree) => {
					try {
						if(!el.shadowRoot)
							el.attachShadow({ mode: "open" })
					} catch(err) {
						console.error('Design layer unable to attach shadow DOM on Element', el);
						console.warn('Please considere to use one of theses tags instead of the ' + el.tagName+' tag.', 'article, aside, blockquote, body, div, footer, h1, h2, h3, h4, h5, h6, header, main, nav, p, section, span'.split(',').map(item => item.trim()));
					}
					if(el.shadowRoot) {
						const CStyles = getComputedStyle(el);
						var tplVars = {
							'attributes' : {},
							'styles' : {},
							'textContent' : el.textContent,
							'innerHTML' : el.innerHTML,
							'innerXML' : el.innerXML,
						}
						for(const a of el.attributes)
							tplVars.attributes[a.name] = a.value;
						for(const s of stylesToObserve)
							tplVars.styles[s] = CStyles.getPropertyValue(s);
						if(el._lastTplVars != tplVars) {
							const result = template(tplVars).trim();
							if(el.shadowRoot.innerHTML.trim() != result)
								el.shadowRoot.innerHTML = result;
							el._lastTplVars = tplVars;
						}
						const event = new Event("refreshDesign");
						el.dispatchEvent(event);
					}
					if(subTree)
						el.querySelectorAll('*').forEach((c) => {	// = flattened childNodes
							if(c.refreshDesign instanceof Function)
								c.refreshDesign();
						})
				}
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
	
	console.log('XPATH EXP : ', XPathExp, 'for', el)
	console.log('XPATH RESULT : ', model.QueryXPath(XPathExp));
	return model.QueryXPath(XPathExp);
}


// 5. DYNAMIC BEHAVIOR
// ===================

const addRefrechContentMethod = (el) => {
	if(el.refreshContent instanceof Function)
		return;
	el.refreshContent = () => {
		if(el.getAttribute('each-item'))	// TODO
			return;
		var value = null;
		var result = '';
		if(el.getAttribute('ref')) {
			ReferencedEl = getReferencedDataElement(el);
			if(ReferencedEl)
				value = ReferencedEl.innerXML;
			else
				value = el.innerXML;
			// + sinon : value = el.innerHTML;
		}
		else
			value = el.innerHTML;
		
		if(el.getAttribute('render-by')) {
			const tid = el.getAttribute('render-by')
			const srcEl = document.querySelector('template#'+tid+', script#'+tid)	// script tolerance type="template" for possible use in (non xml) html sytax
			if(srcEl) {
				const tplVars = {
					value: value,
					settings: (el.innerDOMSettings && innerDOMSettings.itemset) ? innerDOMSettings.itemset : null
				}
				
				if(srcEl.getAttribute('type') == 'text/x-handlebars')
					var template = Handlebars.compile(srcEl.textContent);
				result = template(tplVars);
			}
		}
		else if(el.innerDOMSettings && el.innerDOMSettings.itemset && typeof el.innerDOMSettings.itemset[value] != 'undefined')
			result = el.innerDOMSettings.itemset[value];
		else
			result = value;
		
//console.log(result)
		if(result == null)
			result = '';
		if(el.innerHTML.trim() !== result.trim()) {
			observationEnabled = false;
				el.innerHTML = result;
			observationEnabled = true;
			// modified => refreshDesign too!
			// TODO => déclarer refreshDesign sur le prototype de document ?
/*			
			if(el.refreshDesign instanceof Function)
			   el.refreshDesign(true);
			else
				el.querySelectorAll('*').forEach((c) => {	// = flattened childrenElements
					if(c.refreshDesign instanceof Function)
					   c.refreshDesign();
				})
*/
		}
		
	}
}

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
			if(elToRender.refreshContent instanceof Function)
				elToRender.refreshContent();	// Et c'est tout.
		});
	},
	'body, body *' : (el, action) => {
		console.log(action + ' main flow', el)
		
		const mainFlow = function(){
			if(this.matches('body *[ref] > itemset, t > actions'))
				addElementSettings(this);
			else if(this.getAttribute('ref') || this.getAttribute('each-item') || this.getAttribute('render-by')) {
				if(!this.initialDOM) {
					this.initialDOM = el.innerHTML;
					this.querySelectorAll('itemset, actions').forEach((settingEl) => {
						addElementSettings(settingEl);
					})
				}
				addRefrechContentMethod(this);
				this.refreshContent();
			}
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
		if(el.refreshDesign instanceof Function)
			el.refrehDesign(true);
		else
			el.querySelectorAll('*').forEach((c) => {	// = flattened childrenElements
				if(c.refreshDesign instanceof Function)
					c.refreshDesign();
			})
		
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
