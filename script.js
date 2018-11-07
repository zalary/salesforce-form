var baseUrl = "https://na59.salesforce.com/services/data/v38.0/";

var accessToken = decodeURI(getURLParameter('access_token'));

console.log('token: ' + accessToken);

//Use this function to get the access token from the URL
function getURLParameter(sParam) {
  var mainURL = document.location+'';
  var pageUrls = mainURL.split('#');
  var sURLVariables = pageUrls[1].split('&');
  for (var i = 0; i < sURLVariables.length; i++)  {
    var sParameterName = sURLVariables[i].split('=');
    if (sParameterName[0] == sParam) 
      {
        return sParameterName[1];
      }
  }
}

function searchForLead(contactEmail, contactName, accountName) {
  contactEmail = contactEmail;
  contactName = contactName;
  accountName = accountName;
  console.log('lookup contact' + contactEmail);
  var appendUrl = "parameterizedSearch/?q=" + contactEmail + "&sobject=Lead&Lead.fields=email";
  submitAjax(accessToken, appendUrl, "GET", null, function(result){
    console.log(result);
    if (result.searchRecords.length > 0) {
      // we want to convert the lead, but it requires a special URL call to an 
      // Apex Class which I got from StackOverflow <3 
      $.ajax({
        type: "GET",
        url : 'https://na59.salesforce.com/services/apexrest/Lead/' + result.searchRecords[0].Id,
        crossDomain: true,
        headers : {
          'Authorization' : 'Bearer '+accessToken,
          'Content-Type' : 'application/json'
                    },            
        success : function(){
          // Lead successfully converted, let's use lookup to get the details and continue
          lookup(contactEmail, contactName, accountName);
        },
        error: function(response){
          // Better error handling needed.
          console.log(response);
          alert('Sorry, something went wrong with our form.  Contact our sales team at 1-800-888-8888');
        }
      }); 
    }
    else {
      // no lead was found, let's try to find a contact or account
      lookup(contactEmail, contactName, accountName);
    }  
  }); 
}

// 002 Search for Existing Contact
function lookup(contactEmail, contactName, accountName) {
  contactEmail = contactEmail;
  contactName = contactName;
  accountName = accountName;
  console.log('lookup contact' + contactEmail);
  var appendUrl = "parameterizedSearch/?q=" + contactEmail + "&sobject=Contact&Contact.fields=email";
  submitAjax(accessToken, appendUrl, "GET", null, function(result){
    console.log(result);
    if (result.searchRecords.length > 0) {
      // assumes no existing duplicates on contact email field
        console.log(result);
        var contactId = result.searchRecords[0].Id;
        console.log(contactId);
        getContactAccount(accessToken, contactId, accountName);
    }
    else {
      // 003 Look for Existing Account
      console.log('no contact, look for existing account');
      var appendUrl = "parameterizedSearch/?q=" + accountName + "&sobject=Account&Account.fields=name";
      submitAjax(accessToken, appendUrl, "GET", null, function(result){
        console.log('account search');
        console.log(result);
        if (result.searchRecords.length > 0) {
          // assumes no existing duplicates on account name field
          var accountId = result.searchRecords[0].Id;
          console.log('create contact and associate with account');
          var contactData = {
              "lastname": contactName,
              "Email": contactEmail,
              "AccountId" : accountId
          };
          submitAjax(accessToken, "sobjects/Contact/", "POST", contactData, function(result){
            console.log('create contact result');
            contactId = result.id;
            
            createOppTask(accountId, contactId, accountName); 
          });
        }
        else {
          console.log('need to create contact');
          createAccountContact(accountName, contactName, contactEmail);
        }
      });
    }
    
  });
}

// 004 Get Contact Account
function getContactAccount(accessToken, contactId, accountName) {
  contactId = contactId;
  accountName = accountName;
  console.log('get contact account');
  submitAjax(accessToken, "sobjects/Contact/" + contactId, "GET", null, function(result){
    console.log(result);
    var contactAccountId = result.AccountId;
    console.log(contactAccountId);
    createOppTask(contactAccountId, contactId, accountName); 
  });
}

// 005 Create Account and Contact
function createAccountContact(accountName, contactName, contactEmail) {
  contactEmail = contactEmail;
  contactName = contactName;
  accountName = accountName;
  console.log('create ' + accountName);
  console.log('create account and contact');
  // create the composite request json
  var compositeRequest = {
    "allOrNone" : true,
    "compositeRequest" : [{
        "method" : "POST",
        "url" : "/services/data/v38.0/sobjects/Account",
        "referenceId" : "NewAccount",
        "body" : {
            "Name" : accountName
        }
    },{
        "method" : "GET",
        "referenceId" : "NewAccountInfo",
        "url" : "/services/data/v38.0/sobjects/Account/@{NewAccount.id}"
    },{
        "method" : "POST",
        "url" : "/services/data/v38.0/sobjects/Contact",
        "referenceId" : "NewContact",
        "body" : {
            "lastname": contactName,
            "Email": contactEmail,
            "AccountId" : "@{NewAccountInfo.Id}"
        }
    }]
  };
  submitAjax(accessToken, "composite", "POST", compositeRequest, function(result) {
    accountName = accountName;
    console.log(result);
    var accountId = result.compositeResponse[0].body.id;
    var contactId = result.compositeResponse[2].body.id;
    createOppTask(accountId, contactId, accountName);
  });
}

// 006 Create Opportunity and Task
function createOppTask(accountId, contactId, accountName) {
  accountName = accountName;
  contactId = contactId;
  console.log('create opportunity and task');
  console.log('account name: ' + accountName);
  var currentDate = new Date();
  var threeMonths = currentDate.setMonth(currentDate.getMonth() + 3);
  var closeDate = new Date(threeMonths).toISOString().substring(0, 10);
  var oppTask = {
    "allOrNone" : true,
    "compositeRequest" : [{
        "method" : "POST",
        "url" : "/services/data/v38.0/sobjects/Opportunity",
        "referenceId" : "NewOpportunity",
        "body" : {
            "AccountId" : accountId,
            "Amount" : 599,
            "Description" : "Enterprise opportunity from GoodCo.com pricing page form",
            "Name" : accountName + ' Enterprise Plan',
            "CloseDate" : closeDate,
            "LeadSource": "Website Pricing Page",
            "StageName" : "New"
        }
    },{
        "method" : "GET",
        "referenceId" : "NewOppInfo",
        "url" : "/services/data/v38.0/sobjects/Opportunity/@{NewOpportunity.id}"
    },{
        "method" : "POST",
        "url" : "/services/data/v38.0/sobjects/Task",
        "referenceId" : "NewTask",
        "body" : {
            "Subject": "Follow-up @{NewOppInfo.Name}",
            "Status": "Open",
            "WhatId" : "@{NewOppInfo.Id}",
            "WhoId"  : contactId
            
        }
    }]
  };

  submitAjax(accessToken, "composite", "POST", oppTask, function(result) {
    console.log(result);
    // 006 Update content on success 
    $( "#enterprise .month").html( '<span class="price"><span class="sign">$</span><span class="currency">599</span><span class="cent">.99</span><span class="month">/Month</span></span>' );
    $( "#enterprise #contact" ).html( '<ul><li><span>Unlimited</span> Accounts</li><li><span>Dedicated</span> Account Manager</li></ul>' );   
    $('#enterprise button.generic_price_btn').text("We'll be in touch soon");
  });
}
   
function submitAjax(accessToken, appendUrl, method, requestData, successCallback) {
  $.ajax({
    type: method,
    url : baseUrl + appendUrl,
    crossDomain: true,
    headers : {
      'Authorization' : 'Bearer '+accessToken,
      'Content-Type' : 'application/json'
                },
    data: JSON.stringify(requestData),            
    success : function(response){
      successCallback(response);
    },
    error: function(response){
      // Better error handling needed.
      console.log(response);
      alert('Sorry, something went wrong with our form.  Contact our sales team at 1-800-888-8888');
    }
  }); 
}