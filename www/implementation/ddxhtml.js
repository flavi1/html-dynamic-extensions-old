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

const nodesCallbacks = {
	
	// (el, action, changedTarget, changedAction) => {},
	
	'link[rel="designsheet"]' : (el, action) => {
		console.log(action + ' designsheet', el)
		document.designSheets.add(el.getAttribute('href'))
	},
	'link[rel="stylesheet"]' : (el, action) => {
		console.log(action + ' stylesheet', el)
		document.designSheets.refreshAll();
	},
	'style' : (el, action) => {
		console.log(action + ' style', el)
		document.designSheets.refreshAll();
	},
	'body *[group-ref]' : (el, action) => {	// No need to store initialDOM on it. The DDOM will concerns only its [ref] childs
		console.log(action + ' group-ref ', el)
	},
	'body *[ref], body *[each-item], body *[render-by]' : (el, action) => {
		if(!el.initialDOM)
			el.initialDOM = el.innerHTML;
		console.log(action + ' dynamic element (ref, each-item, render-by)', el)
	},
	'template' : (el, action) => {
		// TODO : list and refresh all corresponding 'body *[renderby="ID"]'
		console.log(action + ' template ', el)
	},
	'body *[ref] > itemset, t > actions' : (settingEl, action) => {
		console.log('innerDOMSettings')
		
		// TODO : store initialDOM if not already done

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
		console.log(el.innerDOMSettings)

	},
}

const attributesChangedCallbacks = {
	'style' : (el, value) => {
		console.log('ATTR style changed', el, value)
		if(el.refreshDesign instanceof Function)
			el.refrehDesign(true);
		else
			el.querySelectorAll('*').forEach((c) => {	// = flattened childNodes
				if(c.refreshDesign instanceof Function)
					c.refreshDesign();
			})
		
	},
	'ref' : (el, value) => {
		if(!el.initialDOM)
			el.initialDOM = el.innerHTML;
		console.log('ATTR ref changed', el, value)
	},
	'renderby' : (el, value) => {
		if(!el.initialDOM)
			el.initialDOM = el.innerHTML;
		console.log('ATTR renderby changed', el, value)
	},
	'each-item' : (el, value) => {
		if(!el.initialDOM)
			el.initialDOM = el.innerHTML;
		console.log('ATTR each-item changed', el, value)
	},
	'shown' : (el, value) => {
		console.log('ATTR shown changed', el, value)
	},
	'action' : (el, value) => {
		// TODO : add/update setting property.
		console.log('t ane action', el, value)
	}
}

function initSelectors() {
	for (var i = 0; i < arguments.length; i++) {
		if(nodesCallbacks[arguments[i]] instanceof Function)
			document.querySelectorAll(arguments[i]).forEach((el) => {
				nodesCallbacks[arguments[i]](el, 'add');
			})
		else
			console.error('nodesCallbacks.'+arguments[i] + ' is not a function : ', nodesCallbacks[arguments[i]],)
	}
}

var observationEnabled = true;

// Create an observer instance linked to the callback function
const observer = new MutationObserver((mutationList, observer) => {
	if(!observationEnabled)
		return;
	var action = '', nodes = [], nodesCB = [], lastAddedNode = null;
	
	mutationList.forEach((mutation) => {
		switch (mutation.type) {
		  case "childList":
			/* One or more children have been added to and/or removed
			   from the tree.
			   (See mutation.addedNodes and mutation.removedNodes.) */
			   nodesCB = nodesCallbacks;
			   
	// TODO : Ajout dynamic des callbacks à partir de Design.Stack
	// console.log('LOG DS LIST ?',document.designSheets)

			   
			   if(mutation.addedNodes.length) 
					nodes = mutation.addedNodes
			   else
					nodes = mutation.removedNodes;

			   if(nodes.length)
					document.designSheets.forEach((ds) => {
					   console.log('!!! DS : ', ds)
					   // feed nodesCB
					})

			   nodes.forEach(function(el) {
					Object.keys(nodesCB).forEach(sel => {
						if(el.nodeType == Node.TEXT_NODE && el.parentNode && el.parentNode.matches instanceof Function && el.parentNode.matches(sel) && el.parentNode != lastAddedNode) {
							nodesCB[sel](el.parentNode, 'changed', el, action);
						}
						else if(el.nodeType == Node.ELEMENT_NODE && el.matches instanceof Function && el.matches(sel))
							if(mutation.addedNodes.length) {
								lastAddedNode = el
								nodesCB[sel](el, 'add');
							}
							else
								nodesCB[sel](el, 'removed');
					});
				})
			break;
		  case "attributes":
			/* An attribute value changed on the element in
			   mutation.target.
			   The attribute name is in mutation.attributeName, and
			   its previous value is in mutation.oldValue. */

			   if(attributesChangedCallbacks[mutation.attributeName] instanceof Function)
					attributesChangedCallbacks[mutation.attributeName](mutation.target, mutation.target.getAttribute(mutation.attributeName))
			break;
		}
	})
console.groupEnd();
});

// Start observing the target node for configured mutations
observer.observe(document, {
	attributes: true,
	childList: true,
	subtree: true,
	attributeFilter: Object.keys(attributesChangedCallbacks)
});	// + attributeOldValue + characterData + characterDataOldValue


window.addEventListener('DOMContentLoaded', () => {
	console.log('window captured by DOMContentLoaded')
	initSelectors('body *[ref] > itemset, t > actions');	// fix :/
	// 'body *[ref], body *[each-item], body *[render-by]' ?
}, true);
