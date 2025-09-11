// Text effects and sampling helpers for Photoshop scripts
(function(){
    if (typeof luminance === 'undefined') {
        luminance = function (r, g, b) {
            return 0.299*r + 0.587*g + 0.114*b;
        };
    }

    if (typeof samplePixel === 'undefined') {
        samplePixel = function (doc, x, y) {
            try {
                while (doc.colorSamplers.length > 0) {
                    doc.colorSamplers[0].remove();
                }
                var colorSampler = doc.colorSamplers.add([UnitValue(x, 'px'), UnitValue(y, 'px')]);
                var c = colorSampler.color.rgb;
                var rgb = [c.red, c.green, c.blue];
                colorSampler.remove();
                return rgb;
            } catch (_e) {
                return [128, 128, 128];
            }
        };
    }

    if (typeof applyWhiteStroke3px === 'undefined') {
        applyWhiteStroke3px = function (targetLayer) {
            try {
                var prev = app.activeDocument.activeLayer;
                app.activeDocument.activeLayer = targetLayer;

                var desc = new ActionDescriptor();
                var ref = new ActionReference();
                ref.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
                desc.putReference(charIDToTypeID('null'), ref);

                var fx = new ActionDescriptor();
                var stroke = new ActionDescriptor();
                stroke.putBoolean(stringIDToTypeID('enabled'), true);
                stroke.putBoolean(stringIDToTypeID('present'), true);
                stroke.putEnumerated(charIDToTypeID('BlnM'), charIDToTypeID('BlnM'), charIDToTypeID('Nrml'));
                stroke.putUnitDouble(charIDToTypeID('Opct'), charIDToTypeID('#Prc'), 100);
                stroke.putEnumerated(stringIDToTypeID('style'), stringIDToTypeID('frameStyle'), stringIDToTypeID('outsetFrame'));
                stroke.putUnitDouble(stringIDToTypeID('size'), charIDToTypeID('#Pxl'), 3);
                stroke.putEnumerated(stringIDToTypeID('paintType'), stringIDToTypeID('paintType'), stringIDToTypeID('solidColor'));

                var clr = new ActionDescriptor();
                clr.putDouble(charIDToTypeID('Rd  '), 255);
                clr.putDouble(charIDToTypeID('Grn '), 255);
                clr.putDouble(charIDToTypeID('Bl  '), 255);
                stroke.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), clr);

                fx.putObject(stringIDToTypeID('frameFX'), stringIDToTypeID('frameFX'), stroke);
                desc.putObject(charIDToTypeID('T   '), stringIDToTypeID('layerEffects'), fx);
                executeAction(charIDToTypeID('setd'), desc, DialogModes.NO);

                app.activeDocument.activeLayer = prev;
            } catch (_e) {}
        };
    }
})();

