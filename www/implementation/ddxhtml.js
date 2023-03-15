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
					namespace: xml.childNodes[0].getAttribute('for'),
					XDSSRulesList : xml.childNodes[0].querySelectorAll('rule')
				})
				document.designSheets.refreshAll();
			}
			else
				throw new Error(url+' is not a valid XDSS file.');
		})
		.catch(err => console.error(err));
}

document.designSheets.refreshAll = () => {
	document.designSheets.forEach((ds) => {
console.log(ds);
		if(ds.namespace == document.documentElement.getAttribute('xmlns'))
			ds.XDSSRulesList.forEach((rule) => {
console.log(rule)
				const sel = rule.getAttribute('selector')
				const stylesToObserve = rule.getAttribute('style-sensitivity').split(",").map(s => s.trim());
				var template = null;
				if(rule.querySelector('template').getAttribute('type') == 'text/x-handlebars')
					template = Handlebars.compile(rule.querySelector('template').textContent)
				else {/* TODO use default html template engine */}
				document.querySelectorAll(sel).forEach((el) => {
console.log(el)
					el.refreshDesign = () => {
						CStyles = getComputedStyle(el);
						if(!el.shadowRoot)
							el.attachShadow({ mode: "open" })
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
						el.shadowRoot.innerHTML = template(tplVars);
						const event = new Event("refreshDesign");
						el.dispatchEvent(event);
						
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
	'body *[ref]' : (el, action) => {
		// TODO : store initialDOM if not already done
		console.log(action + ' ref', el)
	},
	'body *[group-ref]' : (el, action) => {	// No need to store initialDOM on it. The DDOM will concerns only its [ref] childs
		console.log(action + ' group-ref ', el)
	},
	'body *[each-item]' : (el, action) => {
		// TODO : store initialDOM if not already done
		console.log(action + ' each-item ', el)
	},
	'body *[render-by]' : (el, action) => {
		// TODO : store initialDOM if not already done
		console.log(action + ' render-by ', el)
	},
	'template' : (el, action) => {
		// TODO : list and refresh all corresponding 'body *[renderby="ID"]'
		console.log(action + ' template ', el)
	},
	'body *[ref] > itemset, t > actions' : (el, action) => {
		// TODO : store initialDOM if not already done + add/update setting property.
		console.log(action + ' in-DOM settings ', el)
	},
}

const attributesChangedCallbacks = {
	'style' : (el, value) => {
		console.log('ATTR style changed', el, value)
		
	},
	'ref' : (el, value) => {
		console.log('ATTR ref changed', el, value)
	},
	'renderby' : (el, value) => {
		console.log('ATTR renderby changed', el, value)
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
	
console.log('mutationList', mutationList)
	
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
						if(el.nodeType == 3 && el.parentNode && el.parentNode.matches instanceof Function && el.parentNode.matches(sel) && el.parentNode != lastAddedNode) {
							nodesCB[sel](el.parentNode, 'changed', el, action);
						}
						else if(el.matches instanceof Function && el.matches(sel))
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

/*
window.addEventListener('DOMContentLoaded', () => {
	console.log('window captured by DOMContentLoaded')
	//initSelectors('link[rel="designsheet"]');
}, true);
*/

