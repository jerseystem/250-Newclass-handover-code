function onFormSubmit(e) {
  readForm(e);
}

//get data from google form, format appropriately, and create student accounts
function readForm(range) {
  
  var location = range.values[3];
  location = location.substr(0,3);
  
  var program = range.values[6];
  program = program.substr(0,3);
  
  var day = range.values[7];
  day = day.substr(0,2).toUpperCase();
  
  var startTime = range.values[8];
  var time = "";
    
  if (startTime.length == 10) {
    var amOrPm = startTime.substr(7).trim();
    time = startTime.substr(0,4).replace(":","");
    
    if (amOrPm == "PM") {
      var hour = time.substr(0,1);
      var min = time.substr(1);
      hour = parseInt(hour) + 12;
      hour = hour.toString();
      time = hour + min;
    }
    else {
      time = "0" + time;
    }
  }
  
  else if (startTime.length == 11) {
    var amOrPm = startTime.substr(8).trim();
    time = startTime.substr(0,5).replace(":", "");
    var hour = time.substr(0,2);
    var min = time.substr(2);    
    
    if (hour == 12) {
      if (amOrPm == "AM") {
        time = "00" + min;
      }
      else {
        time = hour + min;
      }
    }
    
    else if (amOrPm == "PM" && hour != "12") {
      hour = parseInt(hour) + 12;
      hour = hour.toString();
      time = hour + min;
    }    
  }
  
  //format as program-location-day-time
  var class = program + "-" + location + "-" + day + "-" + time;
  
  var startDate = range.values[9];
  var endDate = range.values[10];
                       
  //find url and id of the roster spreadsheet
  var rosterUrl = range.values[4].toString();
  var rosterId = rosterUrl.substr(33);
  try {
    var roster = SpreadsheetApp.openById(rosterId);
  }
  catch (err) {
    Logger.log("Error opening spreadsheet.\n" + err);
  }
  
  var data = roster.getDataRange().getValues();
  
  //store first name, last name, parent email, parent phone as arrays
  var firstName = [];
  var lastName = [];
  var parentEmail = [];
  var parentPhone = [];
    
  for (var i=1; i < data.length; i++) {
    firstName.push(data[i][0]);
    lastName.push(data[i][1]);
    parentEmail.push(data[i][2]);
    parentPhone.push(data[i][3]);
  }
  
  //check that the names are valid
  var letters = /^[A-Za-z]+$/;
  for (var i=0; i < firstName.length; i++) {
    if (!firstName[i].match(letters)) {
      Logger.log("First name " + firstName[i] + " contains non-alphabetic values.");
      return;
    }
  }
  
  for (var i=0; i < lastName.length; i++) {
    if (!lastName[i].match(letters)) {
      Logger.log("Last name " + lastName[i] + " contains non-alphabetic values.");
      return;
    }
  }      
  
  //check that the email address is valid
  var emailAdd = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  for (var i=0; i < parentEmail.length; i++) {
    if (!emailAdd.test(parentEmail[i])) {
      Logger.log("Email address " + parentEmail[i] + " is not valid.");
      return;
    }
  }
  
  //check that phone number is valid
  var phoneNum = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
  for (var i=0; i < parentPhone.length; i++) {
    if (!parentPhone[i].match(phoneNum)) {
      Logger.log("Phone number " + parentPhone[i] + " should be in format 123-456-7890.");
      return;
    }
  }
  
  //create student accounts
  var students = [];
  
  for (var i=0; i < firstName.length; i++) {
    var user = {
      //account should be changed to jerseystem.net
      primaryEmail: firstName[i].toLowerCase() + "." + lastName[i].toLowerCase() + "@jerseystem.com",
      name: {
        givenName: firstName[i],
        familyName: lastName[i]
      },
      password: "jerseystem",
      //changePasswordAtNextLogin: "True"
    };
  
    students.push(user);    
    //add user to create accounts
    try {
      AdminDirectory.Users.insert(user);
      Logger.log("User %s created with ID %s.", user.primaryEmail, user.id);
    }
    catch (err) {
      Logger.log("Error in creating users.\n" + err);
      //AdminDirectory.Users.remove(user.primaryEmail);
      continue;
    }
  }

  //createGroup(students, class);
  //createClass(students, class);
  //createCalendarEvents(startDate, endDate, startTime, class, students);
  createGroupme(parentEmail, class);
}

//email routing was discontinued, need to use recipient mapping
function setEmailRouting() {
  
}

function createGroup(students, class) {
  //create email group
  var groupEmail = class + ".team@jerseystem.com";
  AdminDirectory.Groups.insert({email: groupEmail});
  
  //add all students to group
  var members = [];
  var member;
  for (var i=0; i < students.length; i++) {
    member = {
      email: students[i].primaryEmail,
      role: "MEMBER"
    };
    members.push(member);
  }
    
  for (var i=0; i < members.length; i++) {
    member = AdminDirectory.Members.insert(members[i], groupEmail);
    //Logger.log("User %s added as a member of group %s.", member.email, groupEmail);
  }
}

function createClass(students, class) {
  //create a google classroom with the name of the class
  var course = Classroom.newCourse();
    
  course.name = class;
  //need to change owner's email address to teacher@jerseystem.org
  course.ownerId = "hye-yoon.jeon@jerseystem.org";
  course = Classroom.Courses.create(course);
  
  //create students invite students to class
  var users = [];
  var user;
  for (var i=0; i < students.length; i++) {
    user = {
      userId: students[i].primaryEmail,
      profile: {
        name: {
          givenName: students[i].firstName,
          familyName: students[i].lastName
        }
      }
    };
    users.push(user);
  }
  
  for (var i=0; i < users.length; i++) {
    user = Classroom.Courses.Students.create(users[i], course.id);
  }
}

function createCalendarEvents(start, end, startTime, class, students) {  
  //format start date for classes appropriately for google calendar
  start = start.split("/");
  var startYear = start[2];
  
  var startMonth = start[0];
  if (startMonth.length == 1) {
    startMonth = "0" + startMonth;
  }

  var startDate = start[1];
  if (startDate.length == 1) {
    startDate = "0" + startDate;
  }

  var fullDate = startYear + "-" + startMonth + "-" + startDate + "T";
  
  //format end date for classes
  end = end.split("/");
  var endYear = end[2];
  
  var endMonth = end[0];
  if (endMonth.length == 1) {
   endMonth = "0" + endMonth; 
  }
  
  var endDate = end[1];
  endDate = parseInt(endDate) + 1;
  endDate = endDate.toString();
  if (endDate.length == 1) {
   endDate = "0" + endDate; 
  }
  
  var end = endYear + endMonth + endDate + "T";
  
  //format event starting time
  if (startTime.length == 10) {
    var amOrPm = startTime.substr(7).trim();
    startTime = startTime.substr(0,7);
    startTime = startTime.split(":");
    var hour = startTime[0];
    var min = startTime[1];
    var sec = startTime[2];
    
    if (amOrPm == "PM") {
      hour = parseInt(hour) + 12;
      hour = hour.toString();
      startTime = hour + ":" + min + ":" + sec;
    }
    else {
      startTime = "0" + hour + ":" + min + ":" + sec;
    }    
  }
  
  else if (startTime.length == 11) {
    var amOrPm = startTime.substr(8).trim();
    startTime = startTime.substr(0,8);
    
    startTime = startTime.split(":");
    var hour = startTime[0];
    var min = startTime[1];
    var sec = startTime[2];
    
    if (hour == 12) {
      if (amOrPm == "AM") {
        startTime = "00:" + min + ":" + sec;
      }
      else {
        startTime = hour + ":" + min + ":" + sec;
      }
    }
    
    else if (amOrPm == "PM" && hour != "12") {
      hour = parseInt(hour) + 12;
      hour = hour.toString();
      startTime = hour + ":" + min + ":" + sec;
    }
    
    startTime = hour + ":" + min + ":" + sec;
  }
  
  //event lasts for 2 hours
  var endTime = startTime.split(":");
  var endHour = endTime[0];
  var endMin = endTime[1];
  var endSec = endTime[2];
  endHour = parseInt(hour) + 2;
  endHour = endHour.toString();
  if (endHour.length == 1) {
    endTime = "0" + endHour + ":" + endMin + ":" + endSec;
  }
  endTime = endHour + ":" + endMin + ":" + endSec;
    
  //create calendar events
  var event = {
    summary: class,
    start: {
      dateTime: fullDate + startTime + "-04:00",
      timeZone: "America/New_York"
    },
    end: {
      dateTime: fullDate + endTime + "-04:00",
      timeZone: "America/New_York"
    },
    attendees: [],
    recurrence: ["RRULE:FREQ=WEEKLY;UNTIL=" + end + endHour + endMin + endSec + "Z"]
  };
  
  for (var i=0; i < students.length; i++) {
    event.attendees.push({email:students[i]});
  }
  
  try {
    //teacher@jerseystem.org
    Calendar.Events.insert(event, "primary");
  }
  catch (err) {
    Logger.log("Error in creating calendar events.\n" + err);
  }
}

function createGroupme(parentEmail, class) {
  //create groupme group
  try {
    var data = {name: class, share: true};
    var params = {headers: {'Content-Type': "application/json", 
                            'Accept': "application/json"}, 
                  method: "POST",
                  payload: JSON.stringify(data), 
                  contentType: "application/json"};
    var group = UrlFetchApp.fetch('https://api.groupme.com/v3/groups?token=929c15505df2013607277bc1a17f51cf', params);
  } 
  catch (err) {
    Logger.log("Error: " + err);
  }
  
  var groupObj = JSON.parse(group);
  var response = groupObj["response"];
  var groupId = response["group_id"];
  //var members = [{nickname: "Hye Yoon Jeon", email: "hye-yoon.jeon@jerseystem.org"}];
  var members = [];
  for (var i=0; i < parentEmail.length; i++) {
    var parentName = parentEmail[i].split("@")[0];
    members.push({nickname: parentName, email: parentEmail[i]});
  }
  try {
    var params = {headers: {'Content-Type': "application/json", 
                            'Accept': "application/json"}, 
                  method: "POST",
                  payload: JSON.stringify(members), 
                  contentType: "application/json"};
        var group = UrlFetchApp.fetch('https://api.groupme.com/v3/groups/' + groupId + '/members/add?token=929c15505df2013607277bc1a17f51cf', params);
  }
  catch (err) {
    Logger.log("Error adding members to Groupme." + err);
  }
}

function createRemind() {
  
}

function sendParentsEmail(parentEmail) {
  var subject = "Welcome Email For Parents";
  var doc = DocumentApp.openByUrl("https://docs.google.com/document/d/19KvpJPkmwqC7N7thwhWz0dQNFBoCRE9YZ5atMXf7x9I/edit");
  var content = doc.getBody().getText();
  for (var i=0; i < parentEmail.length; i++) {
    var address = parentEmail[i];
    MailApp.sendEmail(address, subject, content);
  }
}