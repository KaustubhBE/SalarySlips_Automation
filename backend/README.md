# BE_Salary_Slip_Automation
Automating the process of generation of salary slips of the employees in a organization

# generate
The code containt in here is the code for complete process of fetching, salary slip generation using template, converting into pdf and then storing it into certian folder

# Fetch_Data
Fetches the data of employee's salary details using google sheets id

# Generate_SS
The data fetched is used to replace the place-holders with relevant values of employee's salary details

# Convert_DOC_to_PDF
This function will convert the doc file into pdf

# Save_SS
Using the Process_SS it saves the employees file and folder in the format {Employee_name}_Mon/yy_Salary_Slips.pdf and {Employee_name}_Mon/yy_Salary_Slips

# Process_SS
Used to call all the function in an orderly manner

# Process_All
Contains all the credentials and folder path and calls Process_SS  

