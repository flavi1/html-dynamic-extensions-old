(() => {

	const nativeEvaluate = Object.getOwnPropertyDescriptor(Document.prototype, 'evaluate').value;
	const nativeOuterHTMLGetter = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML').get;
	const nativeInnerHTMLGetter = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').get;
	const nativeInnerHTMLSetter = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;

/*
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
*/
	
	const cleanNSRedundancy = (el = document.documentElement, defaultNS = 'http://www.w3.org/1999/xhtml') => {
		if( ![Node.DOCUMENT_TYPE_NODE, Node.DOCUMENT_NODE ].includes(el.nodeType) && el != document.documentElement) {
			if(el.getAttribute('xmlns') == defaultNS)
				el.removeAttribute('xmlns')
		}
		if(el.getAttribute('xmlns-0') == defaultNS)
			el.removeAttribute('xmlns-0')
		
		if(el.hasAttribute('xmlns-0'))
			defaultNS = el.getAttribute('xmlns-0')
		else if(el.hasAttribute('xmlns'))
			defaultNS = el.getAttribute('xmlns')
		
		for (const child of el.children)
			cleanNSRedundancy(child, defaultNS)
	}
	
	const cloneAttributes = (fromEl, toEl, excludes = []) => {
		if(fromEl.nodeType != Node.ELEMENT_NODE)
			throw new Error('Element Node expected', fromEl);
		if(toEl.nodeType != Node.ELEMENT_NODE)
			throw new Error('Element Node expected', toEl);
		if(!Array.isArray(excludes))
			throw new Error('Array expected', excludes);
		for(const attr of fromEl.attributes)
			if(!excludes.includes(attr.nodeName))
				toEl.setAttribute(attr.nodeName, attr.nodeValue)
	}
	
	window.collectAncestors = (el, includingEl) => {
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
		const nn = el.nodeName;
		var collectedNSs = {}, attributesNodes = [];
		for(parent of collectAncestors(el, true)) {
			for(const attr of parent.attributes)
				if(attr.nodeName.indexOf('xmlns') === 0) {
					if(attr.nodeName === 'xmlns' && !parent.hasAttribute('xmlns-0'))
						attributesNodes.push(attr)
					if(attr.nodeName !== 'xmlns')
						attributesNodes.push(attr)
				}
			for (const attribute of attributesNodes) {
				var ann = attribute.nodeName;
				if(ann == 'xmlns' || ann == 'xmlns-0')
					collectedNSs[(contracted) ? 'xmlns-0' : 'xmlns'] = attribute.nodeValue;
				else {
					var prefix = ann.substring(6);
					if(nn.indexOf(prefix) === 0)
						collectedNSs[(contracted) ? 'xmlns-' + prefix : 'xmlns:' + prefix] = attribute.nodeValue;
				}
			}
		}
		return collectedNSs;
	}
	
	Object.defineProperty(Element.prototype, 'namespaceURI', {get : function () {
		const nn = this.nodeName
		var NSDefinitions = collectNSDefinitions(this, true), delim = null;
		
		var prefix = null
		if(nn.indexOf('-') > 0) {
			prefix = nn.substring(0, nn.indexOf('-'))
			delim = '-'
		}
		if(nn.indexOf(':') > 0) {
			NSDefinitions = collectNSDefinitions(this, false);
			prefix = nn.substring(0, nn.indexOf(':'))
			delim = ':'
		}

//console.warn(this, prefix, NSDefinitions);

		if(prefix && this.hasAttribute('xmlns' + delim + prefix))
			return this.getAttribute('xmlns' + delim + prefix);
		if(this.hasAttribute('xmlns-0'))
			return this.getAttribute('xmlns-0');
		if(this.hasAttribute('xmlns'))
			return this.getAttribute('xmlns');

		if(prefix && typeof NSDefinitions['xmlns' + delim + prefix] != undefined)
			return NSDefinitions['xmlns' + delim + prefix];
		if(typeof NSDefinitions['xmlns-0'] != undefined)
			return NSDefinitions['xmlns-0'];
		if(typeof NSDefinitions['xmlns'] != undefined)
			return NSDefinitions['xmlns'];
		return null;
	} })
	
	const recreateElement = (el, newTagName, avoidAttributesCopy) => {
		const content = el.innerHTML;
		const newTagContainer = document.createElement('div')
		const expectedNS = el.namespaceURI;	 // TODO
		var newtagOuterHTML = '<'+newTagName+'>' + content + '</'+newTagName+'>'


		if(newTagName.indexOf(':') > 0) {	// Firefox intransigence
			prefix = newTagName.substring(0, newTagName.indexOf(':'))
			newtagOuterHTML = '<'+newTagName+' xmlns:'+prefix+'="'+expectedNS+'">' + content + '</'+newTagName+'>'
//console.warn(newtagOuterHTML)
			nativeInnerHTMLSetter.call(newTagContainer, newtagOuterHTML);
		}
		else
			nativeInnerHTMLSetter.call(newTagContainer, newtagOuterHTML);

		const newXML = newTagContainer.getElementsByTagName(newTagName)[0]


		if(!avoidAttributesCopy)
			cloneAttributes(el, newXML)
		
		el.parentNode.replaceChild(newXML, el);
		
		if(typeof el.initialDOM != 'undefined')
			newXML.initialDOM = el.initialDOM;
		return newXML;
	}
	
	const NSExpansion = (target, collectedNSDefinitions) => {
		if(!collectedNSDefinitions) {
			if([Node.DOCUMENT_TYPE_NODE, Node.DOCUMENT_NODE ].includes(target.nodeType))
				target = target.documentElement;
			collectedNSDefinitions = collectNSDefinitions(target, false);
			recursion = false;
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
	}
	
	const cloneDocument = (doc = document, xml = true) => {
		if(doc.nodeType != Node.DOCUMENT_NODE) {
			console.warn(doc)
			throw new Error('Document Node expected');
			return;
		}
		const parser = new DOMParser();
		const cdoc = parser.parseFromString('<html><head></head><body></body></html>', (xml) ? 'text/xml' : 'text/html');
		
		cloneAttributes(doc.documentElement, cdoc.documentElement);
		cloneAttributes(doc.querySelector('head'), cdoc.querySelector('head'));
		cloneAttributes(doc.querySelector('body'), cdoc.querySelector('body'));
		
		cdoc.querySelector('head').innerHTML = doc.querySelector('head').innerHTML;
		cdoc.querySelector('body').innerHTML = doc.querySelector('body').innerHTML;
		
		NSExpansion(cdoc);
		
		return cdoc;
	}
	
	const isElementVirtualyPrefixed = (el) => {
		const nn = el.tagName;
		if(nn.indexOf('-') > 0) {
			var prefix = nn.substring(0, nn.indexOf('-'))
			const collectedNSDefinitions = collectNSDefinitions(el, false);
			if(typeof collectedNSDefinitions['xmlns:' + prefix] != undefined)
				return true;
		}
		return false;
	}
	
	const getDOMPath = (el /*, xml = false*/) => {	 // From https://gist.github.com/karlgroves/7544592
		//if(el.hasAttribute('id') && el.id != '')
		//	return '#'+el.id;	// No because increase debug complexity in case of duplicate id
		var stack = [];
		while (el.parentNode != null) {
			var nn = el.nodeName.toLowerCase()
			var sibCount = 0;
			var sibIndex = 0;
			for ( var i = 0; i < el.parentNode.childNodes.length; i++ ) {
				var sib = el.parentNode.childNodes[i];
				//if ( sib.nodeName == el.nodeName ) {
				if(sib.nodeType == Node.ELEMENT_NODE) {
					if ( sib === el ) {
						sibIndex = sibCount + 1; // :eq starts at 0, but nth-child & nth-of-type starts at 1 (https://stackoverflow.com/questions/15015971/is-there-a-standard-css-selector-similar-to-eq-in-jquery)
						break;
					}
					sibCount++;
				}
			}
			//if(nn.indexOf(':') != -1 || (xml && isElementVirtualyPrefixed(el)) )
			if(nn.indexOf(':') != -1 || isElementVirtualyPrefixed(el) )
				nn = '*';
				//nn = el.nodeName.toLowerCase().replace('-', '\\:');
			if(el.hasAttribute('id') && el.id != '')
				stack.unshift(nn + '#' + el.id);
			else if ( sibCount > 0 )
				stack.unshift(nn + ':nth-child(' + sibIndex + ')');
			else
				stack.unshift(nn);
			el = el.parentNode;
		}
		return stack.slice(1).join(' > '); // removes the html element + return string
	}
	
	window.NSContraction = (el = document.documentElement) => {
		const contractEl = (el) => {
			const nn = el.nodeName
			var attributesNodes = [];
			cleanNSRedundancy(el)
			for(const attr of el.attributes)
				attributesNodes.push(attr)
			if( el.nodeName == 'template' || (el.parentNode && ![Node.DOCUMENT_TYPE_NODE, Node.DOCUMENT_NODE ].includes(el.parentNode.nodeType) ) ) {
			// template elements are likely to not already have a parentNode
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
//console.log(list)
		let iterations = list.length;
		for(const _el of list)
			if(!--iterations)
				el = contractEl(_el)
			else
				contractEl(_el)
//		el.querySelectorAll('*').forEach((subEl) => {subEl.removeAttribute('xmlns')})
//		cleanNSRedundancy(el)
//console.log('NSContraction on ', el)
		return el;
	}

	Object.defineProperty(Element.prototype, 'DOMPath', {get : function () {return getDOMPath(this);} })
	Object.defineProperty(Element.prototype, 'rootNode', {get : function() {
		let rootNode = this;
		while (rootNode.parentNode)
			rootNode = rootNode.parentNode;
		return rootNode;
	}  })
	
	
	Object.defineProperty(Document.prototype, 'evaluate', {
		value: function(xpathExp, n = document.documentElement, NSResolver = null, resultType = null, result = null) {
			if(resultType == null)
				resultType = XPathResult.ANY_TYPE

			//NSResolver = function(p){return 'http://www.w3.org/1999/xhtml';}
			var doc = cloneDocument(this, false);

			if(n == document.documentElement)
				n = doc.documentElement;
			else
				n = doc.querySelector(n.DOMPath);
			
			if(NSResolver !== null)
				return nativeEvaluate.call(cloneDocument(this, true), xpathExp, n, NSResolver, resultType, result);

			return nativeEvaluate.call(doc, xpathExp, n, NSResolver, resultType, result);
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
	
	Object.defineProperty(Element.prototype, 'intricatedXML', {get : function() {	// Return Clone
		if( [Node.DOCUMENT_TYPE_NODE, Node.DOCUMENT_NODE ].includes(this.nodeType) && this == document.documentElement)
			return cloneDocument(document, true).documentElement;
		
		if(this.rootNode != document)
			return null;

		const cdom = cloneDocument(document, true), cloned = cdom.querySelector(this.DOMPath);
		
		cloned.intricatedHTML = this;
		return cloned;
	} })
	
	Object.defineProperty(Element.prototype, 'outerXML', {get : function() {	// Return Clone
		if(this.rootNode != document)
			return nativeOuterHTMLGetter.call(this);
		return nativeOuterHTMLGetter.call(this.intricatedXML);
	} })
	
	Object.defineProperty(Element.prototype, 'innerXML', {
		get : function() {	// Return Clone
			if(this.rootNode != document)
				return nativeInnerHTMLGetter.call(this);
			return nativeInnerHTMLGetter.call(this.intricatedXML);
		}, set : function(content) {
			if(this.rootNode != document)
				return nativeInnerHTMLSetter.call(this, content);
			const cloned = this.intricatedXML;
			nativeInnerHTMLSetter.call(cloned, content)		// apply xml content to cloned
			NSContraction(cloned)
			content = nativeInnerHTMLGetter.call(cloned)	// get contracted cloned.innerHTML
			return nativeInnerHTMLSetter.call(this, content);
		}
	})
	
	const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

	
	Object.defineProperty(Element.prototype, 'innerHTML', {
		get: function() {
			return nativeInnerHTMLGetter.call(this);
		},
		set: function(html) {
			try {
				nativeInnerHTMLSetter.call(this, html);
			} catch(err1) {
				try {
					const HTMLToXML = (html) => {
						const parser = new DOMParser();
						const doc = parser.parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><body>'+html+'</body></html>', 'text/html');	// let's fix HTML unclosed tags
						
						cleanNSRedundancy(doc.body);
						html = doc.body.innerHTML;		// innerHTML getter = native.
						
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
	
})()
