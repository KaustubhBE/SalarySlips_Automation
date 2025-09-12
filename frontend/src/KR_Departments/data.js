// Sample data based on the image
const categories = [
    'Compressor', 'Consummables', 'Continental', 'Controller', 'Cpvc', 'Dust Collector', 'Electrical', 'Etp', 
    'Flange Bearing', 'Granulation', 'Hss Drill', 'Investa Pump', 'Maintenance', 'Maxflow Pump', 'Mc Material', 
    'Miscellaneous', 'MS Material', 'Naga Pump', 'Nuts, Bolts & Washer', 'Oil Seal', 'Packing Sheets', 'Paint', 
    'Pedestal Bearing', 'Plumber Block', 'PPH Material', 'PTFE Material', 'Pulley', 'Pump Motor', 'Pumps', 'PVDF Material', 
    'Reactor Tanks', 'Reactor Unloading', 'Rotary', 'Safety', 'Screw', 'Shaft', 'SKF Bearing', 'Sleeve', 'Spanner', 'Sprocket', 
    'SS Material', 'Stationery', 'Vehicles', 'VFD'
  ]

  // Data structure where category and material name are mandatory
  // Sub-category and particulars are optional and can be missing
  const materialData = {
    'Compressor': {
      subCategories: [],
      particulars: [],
      materialNames: ['Air Compressor 5HP', 'Air Compressor 10HP', 'Compressor Oil Filter', 'Compressor Belt']
    },
    'Consummables': {
      subCategories: [],
      particulars: [],
      materialNames: ['Safety Gloves', 'Safety Goggles', 'Cleaning Cloth', 'Disposable Masks']
    },
    'Continental': {
      subCategories: [],
      particulars: ['V Belt'],
      materialNames: {
        'V Belt': ['3 Ply - 700 mm Width', '3 Ply - 1200 mm Width / 10 mm Thick', 'A-45', 'B-192', 'C-62', 
          'C-68', 'C-73', 'C-79', 'C-83', 'C-86', 'C-88', 'C-92', 'C-96', 'C-97', 'C-98', 'C-99', 'C-101', 'C-110', 'C-115', 
          'C-118', 'C-125', 'C-128', 'C-134', 'C-150', 'C-166', 'C-170', 'C-175', 'C-192', 'C-196']
      }
    },
    'Controller': {
      subCategories: [],
      particulars: [],
      materialNames: ['Al - 7981 Temperature Controller', 'PID Controller', 'Pressure Controller', 'Flow Controller']
    },
    'Cpvc': {
      subCategories: [],
      particulars: [],
      materialNames: ['Cpvc Bend 1 inches', 'Cpvc Bend 1.5 inches', 'Cpvc Ball Valve 1 inches', 'Cpvc Ball Valve 1.5 inches', 
        'Cpvc Coller 1 inches', 'Cpvc Coller 1.5 inches', 'Cpvc Fta 1 inches', 'Cpvc Male Adaptor 1 inches', 
        'Cpvc Pipe 1.5 inches 5 mtr', 'Cpvc Solvent 118 ml', 'Cpvc Tank Nipple 1 inches', 'Cpvc Tank Nipple 1.5 inches', 
        'Cpvc Tee 1 inches', 'Cpvc Tee 1.5 inches', 'Cpvc Reduser 1.5 inches * 1 inches']
    },
    'Dust Collector': {
      subCategories: [],
      particulars: [],
      materialNames: ['Dust Collector Bag', 'Dust Collector Filter', 'Dust Collector Motor', 'Dust Collector Duct']
    },
    'Electrical': {
      subCategories: [],
      particulars: [],
      materialNames: ['Electrical Wire 2.5mm', 'Electrical Wire 4mm', 'MCB 16A', 'MCB 32A', 'Switch Socket', 'LED Bulb']
    },
    'Etp': {
      subCategories: [],
      particulars: [],
      materialNames: ['ETP Pump', 'ETP Filter', 'ETP Chemical', 'ETP Pipe']
    },
    'Flange Bearing': {
      subCategories: [],
      particulars: [],
      materialNames: ['Flange Bearing 6205', 'Flange Bearing 6206', 'Flange Bearing 6207', 'Flange Bearing 6208']
    },
    'Granulation': {
      subCategories: [],
      particulars: [],
      materialNames: ['Granulation Die', 'Granulation Knife', 'Granulation Screen', 'Granulation Roller']
    },
    'Hss Drill': {
      subCategories: [],
      particulars: [],
      materialNames: ['HSS Drill 3mm', 'HSS Drill 5mm', 'HSS Drill 8mm', 'HSS Drill 10mm', 'HSS Drill 12mm']
    },
    'Investa Pump': {
      subCategories: [],
      particulars: [],
      materialNames: ['Investa Pump 1HP', 'Investa Pump 2HP', 'Investa Pump 5HP', 'Investa Pump Spare Parts']
    },
    'Maintenance': {
      subCategories: [],
      particulars: [],
      materialNames: ['Maintenance Kit', 'Lubricating Oil', 'Grease Gun', 'Maintenance Tools']
    },
    'Maxflow Pump': {
      subCategories: [],
      particulars: [],
      materialNames: ['Maxflow Pump 1HP', 'Maxflow Pump 2HP', 'Maxflow Pump 5HP', 'Maxflow Pump Spare Parts']
    },
    'Mc Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['MC Sheet 1mm', 'MC Sheet 2mm', 'MC Sheet 3mm', 'MC Angle', 'MC Channel']
    },
    'Miscellaneous': {
      subCategories: [],
      particulars: [],
      materialNames: ['Miscellaneous Items', 'General Purpose Items', 'Various Components']
    },
    'MS Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['MS Sheet 1mm', 'MS Sheet 2mm', 'MS Sheet 3mm', 'MS Angle', 'MS Channel', 'MS Pipe']
    },
    'Naga Pump': {
      subCategories: [],
      particulars: [],
      materialNames: ['Naga Pump 1HP', 'Naga Pump 2HP', 'Naga Pump 5HP', 'Naga Pump Spare Parts']
    },
    'Nuts, Bolts & Washer': {
      subCategories: [],
      particulars: [],
      materialNames: ['M8 Nuts', 'M10 Nuts', 'M12 Nuts', 'M8 Bolts', 'M10 Bolts', 'M12 Bolts', 'Washers', 'Spring Washers']
    },
    'Oil Seal': {
      subCategories: [],
      particulars: [],
      materialNames: ['Oil Seal 20x35x7', 'Oil Seal 25x40x7', 'Oil Seal 30x45x7', 'Oil Seal 35x50x7']
    },
    'Packing Sheets': {
      subCategories: [],
      particulars: [],
      materialNames: ['Packing Sheet 1mm', 'Packing Sheet 2mm', 'Packing Sheet 3mm', 'Packing Sheet 5mm']
    },
    'Paint': {
      subCategories: [],
      particulars: [],
      materialNames: ['Red Paint 1L', 'Blue Paint 1L', 'Green Paint 1L', 'White Paint 1L', 'Black Paint 1L']
    },
    'Pedestal Bearing': {
      subCategories: [],
      particulars: [],
      materialNames: ['Pedestal Bearing 6205', 'Pedestal Bearing 6206', 'Pedestal Bearing 6207', 'Pedestal Bearing 6208']
    },
    'Plumber Block': {
      subCategories: [],
      particulars: [],
      materialNames: ['Plumber Block 1 inch', 'Plumber Block 1.5 inch', 'Plumber Block 2 inch', 'Plumber Block 3 inch']
    },
    'PPH Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['PPH Pipe 1 inch', 'PPH Pipe 1.5 inch', 'PPH Pipe 2 inch', 'PPH Fitting', 'PPH Valve']
    },
    'PTFE Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['PTFE Sheet 1mm', 'PTFE Sheet 2mm', 'PTFE Sheet 3mm', 'PTFE Gasket', 'PTFE Tape']
    },
    'Pulley': {
      subCategories: [],
      particulars: [],
      materialNames: ['Pulley 2 inch', 'Pulley 3 inch', 'Pulley 4 inch', 'Pulley 5 inch', 'Pulley 6 inch']
    },
    'Pump Motor': {
      subCategories: [],
      particulars: [],
      materialNames: ['Pump Motor 1HP', 'Pump Motor 2HP', 'Pump Motor 5HP', 'Pump Motor 10HP']
    },
    'Pumps': {
      subCategories: ['Alfa Pump', 'Apex Pump'],
      particulars: {
        'Alfa Pump': ['5 HP, ALFA 160 CT'],
        'Apex Pump': ['5 HP, ACP - 55']
      },
      materialNames: {
        'Alfa Pump': {
          '5 HP, ALFA 160 CT': ['Back Plate', 'Bearing 3306', 'Casing', 'Impeller', 'Pump Shaft NK-C 100, 112', 
            'Shaft', 'Stationary Seal Ring, Alfa -Kss -R/D']
        },
        'Apex Pump': {
          '5 HP, ACP - 55': ['Adopter', 'Armour Plate MS', 'Bearing Frame', 
            'Ceramic Sleeve', 'Ceramic Stationary', 'Ceramic Stationary 3/8*', 'Fastner (SS Stud 3/8" * 6" with Nut Washer)', 
            'Fastner (SS Stud 3/8" * 3")', 'GFPP Back Cover / Back Plate', 'GFPP Impeller', 'Gland Plate', 'PP Casing', 
            'PP Impeller', 'Shaft', 'Teflon Bellow Silicon Face Rotary', 'Teflon Bellow Silicon Face / Rotary  3/8"']
        }
      }
    },
    'PVDF Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['PVDF Sheet 1mm', 'PVDF Sheet 2mm', 'PVDF Sheet 3mm', 'PVDF Pipe', 'PVDF Fitting']
    },
    'Reactor Tanks': {
      subCategories: [],
      particulars: [],
      materialNames: ['Reactor Tank 100L', 'Reactor Tank 500L', 'Reactor Tank 1000L', 'Reactor Tank 2000L']
    },
    'Reactor Unloading': {
      subCategories: [],
      particulars: [],
      materialNames: ['Unloading Pump', 'Unloading Valve', 'Unloading Pipe', 'Unloading Fitting']
    },
    'Rotary': {
      subCategories: [],
      particulars: [],
      materialNames: ['Rotary Joint', 'Rotary Seal', 'Rotary Bearing', 'Rotary Shaft']
    },
    'Safety': {
      subCategories: [],
      particulars: [],
      materialNames: ['Safety Helmet', 'Safety Shoes', 'Safety Harness', 'Fire Extinguisher', 'First Aid Kit']
    },
    'Screw': {
      subCategories: [],
      particulars: [],
      materialNames: ['Screw M6x20', 'Screw M8x25', 'Screw M10x30', 'Screw M12x35', 'Screw M16x40']
    },
    'Shaft': {
      subCategories: [],
      particulars: [],
      materialNames: ['Shaft 20mm', 'Shaft 25mm', 'Shaft 30mm', 'Shaft 35mm', 'Shaft 40mm']
    },
    'SKF Bearing': {
      subCategories: [],
      particulars: [],
      materialNames: ['SKF Bearing 6205', 'SKF Bearing 6206', 'SKF Bearing 6207', 'SKF Bearing 6208', 'SKF Bearing 6309']
    },
    'Sleeve': {
      subCategories: [],
      particulars: [],
      materialNames: ['Sleeve 20mm', 'Sleeve 25mm', 'Sleeve 30mm', 'Sleeve 35mm', 'Sleeve 40mm']
    },
    'Spanner': {
      subCategories: [],
      particulars: [],
      materialNames: ['Spanner Set 8-32mm', 'Spanner 10mm', 'Spanner 12mm', 'Spanner 14mm', 'Spanner 17mm']
    },
    'Sprocket': {
      subCategories: [],
      particulars: [],
      materialNames: ['Sprocket 20 Teeth', 'Sprocket 30 Teeth', 'Sprocket 40 Teeth', 'Sprocket 50 Teeth']
    },
    'SS Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['SS Sheet 1mm', 'SS Sheet 2mm', 'SS Sheet 3mm', 'SS Angle', 'SS Channel', 'SS Pipe']
    },
    'Stationery': {
      subCategories: [],
      particulars: [],
      materialNames: ['Pen', 'Pencil', 'Notebook', 'File Folder', 'Stapler', 'Paper']
    },
    'Vehicles': {
      subCategories: [],
      particulars: [],
      materialNames: ['Vehicle Spare Parts', 'Engine Oil', 'Brake Fluid', 'Coolant', 'Tire']
    },
    'VFD': {
      subCategories: [],
      particulars: [],
      materialNames: ['Vfd 3 Hp', 'Vfd 5 Hp', 'Vfd 7.5 Hp', 'Vfd 15 Hp']
    }
  }


  const uomOptions = ['kgs', 'nos', 'meters', 'pieces', 'liters']
  const importanceOptions = ['Normal', 'Urgent', 'Very-Urgent']