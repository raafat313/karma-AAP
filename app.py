import tkinter as tk
from time import strftime

def time():
    string = strftime('%I:%M:%S %p')
    lbl.config(text=string)
    lbl.after(1000, time)

root = tk.Tk()
root.title('Digital Clock')
root.geometry('400x150')
root.resizable(False, False)

# Set background color
root.configure(bg='black')

# Styling the label widget
lbl = tk.Label(root, font=('calibri', 40, 'bold'),
               background='black',
               foreground='cyan')

# Placing clock at the center
lbl.pack(anchor='center', expand=True)

time()

root.mainloop()
