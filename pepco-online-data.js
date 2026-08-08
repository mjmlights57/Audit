(function attachPepcoOnlineDefaults(global) {
  const rows = [
    { section: 'Name Your Project', field: 'Project Name:', value: '0' },

    { section: 'Facility Information', field: 'First & Last Name: *', value: '0' },
    { section: 'Facility Information', field: 'Company: *', value: '0' },
    { section: 'Facility Information', field: 'Acct #: *', value: '0' },
    { section: 'Facility Information', field: 'Meter ID:', value: '' },
    { section: 'Facility Information', field: 'Address: *', value: '0' },
    { section: 'Facility Information', field: 'Address (cont):', value: '' },
    { section: 'Facility Information', field: 'City: *', value: '0' },
    { section: 'Facility Information', field: 'State/Province: *', value: '0' },
    { section: 'Facility Information', field: 'Postal Code: *', value: '0' },
    { section: 'Facility Information', field: 'Phone: *', value: '0' },
    { section: 'Facility Information', field: 'eMail: *', value: '0' },
    { section: 'Facility Information', field: 'Save contact for later use in your contact list?', value: 'Yes' },

    { section: 'Customer Mailing Information', field: 'Same as home/business information', value: 'Check the Box' },
    { section: 'Customer Mailing Information', field: 'Save this as a new contact in my profile contact list', value: 'Uncheck the Box' },

    { section: 'Contractor Selection', field: 'Click Search for a Contractor and select EWPros', value: 'EWPros,LLC' },
    { section: 'Contractor Selection', field: 'Contact Person', value: 'Mtijan Kamara' },
    { section: 'Contractor Selection', field: 'Phone', value: '1-800-731-6750' },
    { section: '(Optional) Additional Contact to Receive Project Information', field: 'Additional contact section', value: 'Skip Section' },

    { section: 'Project Schedule', field: 'Expected Completion Date', value: '', dateRule: 'twoMonthsFromToday', inputType: 'date' },

    { section: 'Savings and Incentive Information', field: 'Total Requested Incentive *', value: 'Extract data from workbook' },
    { section: 'Savings and Incentive Information', field: 'Total Estimated kWh Savings *', value: 'Extract data from workbook' },

    { section: 'Project Information', field: 'Title of Utility Customer (e.g. Energy Manager, CFO, etc.) *', value: '' },
    { section: 'Project Information', field: 'Application is being completed by *', value: 'Service Provider' },
    { section: 'Project Information', field: 'Application Date *', value: '', dateRule: 'today', inputType: 'date' },
    { section: 'Project Information', field: 'Is the premise company a National Account? *', value: 'No' },
    { section: 'Project Information', field: 'Installation Contractor - Retrofit Lighting', value: 'EWPros' },
    { section: 'Project Information', field: 'If "Self-Install" is selected', value: 'N/A' },
    { section: 'Project Information', field: 'Installation Contractor - Sign Lighting *', value: 'N/A' },
    { section: 'Project Information', field: 'If "Self-Install" is selected', value: 'N/A' },
    { section: 'Project Information', field: 'Business Type', value: 'Uncheck the Box' },
    { section: 'Project Information', field: 'Business Sector *', value: '' },
    { section: 'Project Information', field: 'Building Type *', value: '' },
    { section: 'Project Information', field: 'Square Footage By Application', value: '' },

    { section: 'Payee Information', field: 'Check Payable To *', value: 'Contractor' },
    { section: 'Payee Information', field: 'Check Payable Name *', value: 'EWPros, LLC' },
    { section: 'Payee Information', field: 'Payee Contact Name *', value: 'Mtijan Kamara' },
    { section: 'Payee Information', field: 'Payee Address *', value: '4806 Silverbrook way' },
    { section: 'Payee Information', field: 'Payee City *', value: 'Bowie' },
    { section: 'Payee Information', field: 'Payee State *', value: 'MD' },
    { section: 'Payee Information', field: 'Payee Zip Code *', value: '20720' },

    { section: 'Contractor Submitted Documents', field: 'Do you have additional documentation to upload with your application? *', value: 'Other Supporting Documents' }
  ];

  global.EWPROS_PEPCO_ONLINE = {
    columns: [
      { key: 'section', label: 'Online Portal Section' },
      { key: 'field', label: 'Portal Field / Instruction' },
      { key: 'value', label: 'Value / Action' }
    ],
    rows
  };
})(typeof window !== 'undefined' ? window : globalThis);
